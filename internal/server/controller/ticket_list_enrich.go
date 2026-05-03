package controller

import (
	"fmt"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
)

func enrichTicketListWithAttachments(attachmentRepository *repository.AttachmentRepository, tickets []model.TicketWithUserName) {
	if attachmentRepository == nil || len(tickets) == 0 {
		return
	}
	ids := make([]int, len(tickets))
	for i := range tickets {
		ids[i] = tickets[i].ID
	}
	rows, err := attachmentRepository.ListByTicketIDs(ids)
	if err != nil || len(rows) == 0 {
		return
	}
	byTicket := make(map[int][]model.TicketAttachment)
	for _, row := range rows {
		att := model.TicketAttachment{
			ID:           row.ID,
			OriginalName: row.OriginalName,
			MimeType:     row.MimeType,
			SizeBytes:    row.SizeBytes,
			URL:          fmt.Sprintf("/api/files/tickets/%d/attachments/%d", row.TicketID, row.ID),
		}
		byTicket[row.TicketID] = append(byTicket[row.TicketID], att)
	}
	for i := range tickets {
		if atts, ok := byTicket[tickets[i].ID]; ok {
			tickets[i].Attachments = atts
		}
	}
}
