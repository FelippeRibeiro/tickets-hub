package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const (
	linkPreviewTimeout  = 4 * time.Second
	linkPreviewMaxBytes = 1024 * 1024
	linkPreviewMaxHops  = 3
)

type LinkPreviewController struct {
	client *http.Client
}

type linkPreviewResponse struct {
	URL         string `json:"url"`
	Host        string `json:"host"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
}

func NewLinkPreviewController() *LinkPreviewController {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, err
			}
			if err := validateRemoteHost(ctx, host); err != nil {
				return nil, err
			}
			var d net.Dialer
			return d.DialContext(ctx, network, net.JoinHostPort(host, port))
		},
		TLSHandshakeTimeout: 4 * time.Second,
	}

	client := &http.Client{
		Timeout:   linkPreviewTimeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= linkPreviewMaxHops {
				return errors.New("too many redirects")
			}
			return validatePreviewURL(req.URL)
		},
	}

	return &LinkPreviewController{client: client}
}

func (lc *LinkPreviewController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/link-preview", http.HandlerFunc(lc.GetLinkPreview))
}

func (lc *LinkPreviewController) GetLinkPreview(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rawURL := strings.TrimSpace(r.URL.Query().Get("url"))
	if rawURL == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "url is required"})
		return
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid url"})
		return
	}
	if err := validatePreviewURL(parsed); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	preview, statusErr := lc.fetchPreview(r.Context(), parsed)
	if statusErr != nil {
		code := http.StatusBadGateway
		if errors.Is(statusErr, errPreviewUnsupported) {
			code = http.StatusUnprocessableEntity
		}
		w.WriteHeader(code)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": statusErr.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(preview)
}

var (
	errPreviewUnsupported = errors.New("link preview unavailable for this URL")
	reTitle               = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
	reMetaTag             = regexp.MustCompile(`(?is)<meta\b[^>]*>`)
	reAttr                = regexp.MustCompile(`(?is)([a-zA-Z_:][a-zA-Z0-9_:\-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`)
	reWhitespace          = regexp.MustCompile(`\s+`)
)

func (lc *LinkPreviewController) fetchPreview(ctx context.Context, parsed *url.URL) (*linkPreviewResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, errPreviewUnsupported
	}
	req.Header.Set("User-Agent", "tickets-hub-link-preview/1.0")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	res, err := lc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("could not fetch preview")
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 400 {
		return nil, fmt.Errorf("remote site returned status %d", res.StatusCode)
	}

	contentType := strings.ToLower(res.Header.Get("Content-Type"))
	if contentType != "" && !strings.Contains(contentType, "text/html") && !strings.Contains(contentType, "application/xhtml+xml") {
		return nil, errPreviewUnsupported
	}

	body, err := io.ReadAll(io.LimitReader(res.Body, linkPreviewMaxBytes))
	if err != nil {
		return nil, fmt.Errorf("could not read preview content")
	}

	title := firstNonEmpty(
		extractMetaContent(body, "property", "og:title"),
		extractMetaContent(body, "name", "twitter:title"),
		extractTitle(body),
	)
	description := firstNonEmpty(
		extractMetaContent(body, "property", "og:description"),
		extractMetaContent(body, "name", "description"),
		extractMetaContent(body, "name", "twitter:description"),
	)

	title = sanitizeMeta(title, 140)
	description = sanitizeMeta(description, 240)
	if title == "" && description == "" {
		return nil, errPreviewUnsupported
	}

	return &linkPreviewResponse{
		URL:         res.Request.URL.String(),
		Host:        res.Request.URL.Hostname(),
		Title:       title,
		Description: description,
	}, nil
}

func validatePreviewURL(parsed *url.URL) error {
	if parsed == nil {
		return errors.New("invalid url")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("only http and https links are supported")
	}
	if parsed.Hostname() == "" {
		return errors.New("invalid url host")
	}
	if parsed.User != nil {
		return errors.New("urls with embedded credentials are not allowed")
	}
	return validateRemoteHost(context.Background(), parsed.Hostname())
}

func validateRemoteHost(ctx context.Context, host string) error {
	host = strings.TrimSpace(host)
	if host == "" {
		return errors.New("invalid url host")
	}

	if ip, err := netip.ParseAddr(host); err == nil {
		if isPrivateAddr(ip) {
			return errors.New("private or local network addresses are not allowed")
		}
		return nil
	}

	ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil {
		return errors.New("could not resolve remote host")
	}
	if len(ips) == 0 {
		return errors.New("could not resolve remote host")
	}
	for _, ip := range ips {
		if isPrivateAddr(ip) {
			return errors.New("private or local network addresses are not allowed")
		}
	}
	return nil
}

func isPrivateAddr(ip netip.Addr) bool {
	return ip.IsLoopback() ||
		ip.IsPrivate() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() ||
		ip.IsMulticast() ||
		ip.IsInterfaceLocalMulticast() ||
		ip.IsUnspecified()
}

func extractTitle(body []byte) string {
	match := reTitle.FindSubmatch(body)
	if len(match) < 2 {
		return ""
	}
	return decodeMinimalHTML(string(match[1]))
}

func extractMetaContent(body []byte, attrName, attrValue string) string {
	lowerAttrValue := strings.ToLower(attrValue)
	for _, tag := range reMetaTag.FindAll(body, -1) {
		attrs := map[string]string{}
		for _, attr := range reAttr.FindAllSubmatch(tag, -1) {
			key := strings.ToLower(string(attr[1]))
			value := ""
			switch {
			case len(attr[3]) > 0:
				value = string(attr[3])
			case len(attr[4]) > 0:
				value = string(attr[4])
			default:
				value = string(attr[5])
			}
			attrs[key] = value
		}
		if strings.ToLower(attrs[strings.ToLower(attrName)]) == lowerAttrValue {
			return decodeMinimalHTML(attrs["content"])
		}
	}
	return ""
}

func sanitizeMeta(value string, max int) string {
	value = strings.TrimSpace(reWhitespace.ReplaceAllString(value, " "))
	if value == "" {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return strings.TrimSpace(string(runes[:max-1])) + "…"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

var htmlEntityReplacer = strings.NewReplacer(
	"&amp;", "&",
	"&lt;", "<",
	"&gt;", ">",
	"&quot;", "\"",
	"&#39;", "'",
	"&nbsp;", " ",
)

func decodeMinimalHTML(value string) string {
	value = htmlEntityReplacer.Replace(value)
	return string(bytes.TrimSpace([]byte(value)))
}
