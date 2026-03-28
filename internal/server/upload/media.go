package upload

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const MaxMediaBytes = 1 << 30 // 1 GiB

func AllowedMime(mime string) bool {
	mime = strings.TrimSpace(strings.ToLower(mime))
	if mime == "" {
		return false
	}
	return strings.HasPrefix(mime, "image/") || strings.HasPrefix(mime, "video/")
}

// SaveMedia grava um arquivo em uploadRoot/segment/parentID/<uuid>.ext e devolve caminho relativo (slashes).
func SaveMedia(uploadRoot, segment string, parentID int, file multipart.File, header *multipart.FileHeader) (relPath string, mime string, written int64, err error) {
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = ".bin"
	}
	token := make([]byte, 16)
	if _, err := rand.Read(token); err != nil {
		return "", "", 0, err
	}
	storedName := hex.EncodeToString(token) + ext
	relPath = filepath.Join(segment, strconv.Itoa(parentID), storedName)
	absDir := filepath.Join(uploadRoot, segment, strconv.Itoa(parentID))
	if err := os.MkdirAll(absDir, 0o755); err != nil {
		return "", "", 0, err
	}
	absFile := filepath.Join(absDir, storedName)

	dst, err := os.Create(absFile)
	if err != nil {
		return "", "", 0, err
	}

	written, err = io.Copy(dst, io.LimitReader(file, MaxMediaBytes+1))
	if cerr := dst.Close(); cerr != nil && err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(absFile)
		return "", "", 0, err
	}
	if written > MaxMediaBytes {
		_ = os.Remove(absFile)
		return "", "", 0, fmt.Errorf("file too large")
	}

	readBuf := make([]byte, 512)
	fh, err := os.Open(absFile)
	if err != nil {
		_ = os.Remove(absFile)
		return "", "", 0, err
	}
	n, _ := fh.Read(readBuf)
	_ = fh.Close()
	mime = http.DetectContentType(readBuf[:n])
	if header.Header.Get("Content-Type") != "" {
		declared := strings.TrimSpace(strings.ToLower(header.Header.Get("Content-Type")))
		if i := strings.Index(declared, ";"); i >= 0 {
			declared = declared[:i]
		}
		if strings.HasPrefix(declared, "image/") || strings.HasPrefix(declared, "video/") {
			mime = declared
		}
	}
	if !AllowedMime(mime) {
		_ = os.Remove(absFile)
		return "", "", 0, fmt.Errorf("only image and video files are allowed")
	}

	return filepath.ToSlash(relPath), mime, written, nil
}
