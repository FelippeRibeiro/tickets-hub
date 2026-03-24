
FROM golang:latest AS builder


WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download


COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build  cmd/api/main.go

FROM node:lts AS web-builder
WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build



FROM alpine:latest

RUN adduser -D appuser
USER appuser

WORKDIR /app
COPY --from=builder /app/main .
COPY --from=web-builder /app/dist/ ./frontend/dist

EXPOSE 8080

# Run the application
CMD ["./main"]
