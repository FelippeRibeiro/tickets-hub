package discord

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const httpTimeout = 8 * time.Second

// WebhookPayload is a minimal Discord webhook body (embed).
type WebhookPayload struct {
	Embeds []Embed `json:"embeds,omitempty"`
}

// Embed matches Discord embed JSON (subset).
type Embed struct {
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	URL         string `json:"url,omitempty"`
	Color       int    `json:"color,omitempty"`
}

// DescriptionExcerptPercent returns the first `percent` (0–1) of the description as runes, with ellipsis if truncated.
func DescriptionExcerptPercent(description string, percent float64) string {
	s := strings.TrimSpace(description)
	if s == "" {
		return ""
	}
	runes := []rune(s)
	n := len(runes)
	if n == 0 {
		return ""
	}
	take := int(float64(n) * percent)
	if take < 1 {
		take = 1
	}
	if take > n {
		take = n
	}
	out := string(runes[:take])
	if take < n {
		out += "…"
	}
	return out
}

// NotifyNewTicket posts an embed to the webhook (best-effort; errors are ignored by design for callers using goroutines).
// publishedByLabel is the name safe to show (never the real account name when isAnonymous is true — caller must pass "Anônimo" or similar).
func NotifyNewTicket(ctx context.Context, webhookURL, publicBaseURL string, ticketID int, title, topicName, description string, isAnonymous bool, publishedByLabel string) error {
	webhookURL = strings.TrimSpace(webhookURL)
	publicBaseURL = strings.TrimRight(strings.TrimSpace(publicBaseURL), "/")
	if webhookURL == "" || publicBaseURL == "" || ticketID <= 0 {
		return nil
	}

	embedTitle := "Novo ticket publicado"
	if isAnonymous {
		embedTitle = "Novo ticket anônimo"
	}

	publishedBy := strings.ReplaceAll(strings.TrimSpace(publishedByLabel), "\n", " ")
	if publishedBy == "" {
		if isAnonymous {
			publishedBy = "Anônimo"
		} else {
			publishedBy = "Desconhecido"
		}
	}

	ticketURL := fmt.Sprintf("%s/ticket/%d", publicBaseURL, ticketID)
	title = strings.ReplaceAll(strings.TrimSpace(title), "\n", " ")
	topic := strings.TrimSpace(topicName)
	if topic == "" {
		topic = "(sem tópico)"
	} else {
		topic = strings.ReplaceAll(topic, "\n", " ")
	}

	excerpt := DescriptionExcerptPercent(description, 0.3)
	if excerpt == "" {
		excerpt = "_(sem descrição)_"
	}

	desc := fmt.Sprintf(
		"**Publicado por:** %s\n**Título:** %s\n**Tópico:** %s\n**Trecho (30%% da descrição):**\n%s\n\n%s",
		publishedBy,
		title,
		topic,
		excerpt,
		ticketURL,
	)
	// Discord embed description limit is 4096; stay safe.
	const maxDesc = 3800
	if len(desc) > maxDesc {
		desc = desc[:maxDesc] + "…"
	}

	payload := WebhookPayload{
		Embeds: []Embed{
			{
				Title:       embedTitle,
				Description: desc,
				URL:         ticketURL,
				Color:       3447003,
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	reqCtx, cancel := context.WithTimeout(ctx, httpTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: httpTimeout}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("discord webhook: status %d", res.StatusCode)
	}
	return nil
}
