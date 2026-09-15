-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "toolArguments" JSONB,
ADD COLUMN     "toolCallId" TEXT,
ADD COLUMN     "toolName" TEXT,
ADD COLUMN     "toolResult" JSONB;

-- CreateIndex
CREATE INDEX "Message_toolCallId_idx" ON "Message"("toolCallId");
