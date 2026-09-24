ALTER TABLE "CalendarEvent" ADD COLUMN "description" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "CalendarEventAssignee" DROP CONSTRAINT "CalendarEventAssignee_eventId_fkey";
ALTER TABLE "CalendarEventAssignee" ADD CONSTRAINT "CalendarEventAssignee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
