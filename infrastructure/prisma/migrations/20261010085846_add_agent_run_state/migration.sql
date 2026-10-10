-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "currentTool" TEXT,
ADD COLUMN     "iteration" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "phase" TEXT NOT NULL DEFAULT 'queued',
ADD COLUMN     "toolCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AgentRunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentRunEvent_runId_idx" ON "AgentRunEvent"("runId");

-- CreateIndex
CREATE INDEX "AgentRunEvent_createdAt_idx" ON "AgentRunEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AgentRunEvent_type_idx" ON "AgentRunEvent"("type");

-- CreateIndex
CREATE INDEX "AgentRun_phase_idx" ON "AgentRun"("phase");

-- CreateIndex
CREATE INDEX "AgentRun_lastHeartbeatAt_idx" ON "AgentRun"("lastHeartbeatAt");

-- AddForeignKey
ALTER TABLE "AgentRunEvent" ADD CONSTRAINT "AgentRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
