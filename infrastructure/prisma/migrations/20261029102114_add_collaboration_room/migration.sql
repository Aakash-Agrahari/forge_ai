-- CreateTable
CREATE TABLE "CollaborationRoom" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborationRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationRoom_projectId_key" ON "CollaborationRoom"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationRoom_shareToken_key" ON "CollaborationRoom"("shareToken");

-- CreateIndex
CREATE INDEX "CollaborationRoom_ownerId_idx" ON "CollaborationRoom"("ownerId");

-- CreateIndex
CREATE INDEX "CollaborationRoom_shareToken_idx" ON "CollaborationRoom"("shareToken");

-- CreateIndex
CREATE INDEX "CollaborationRoom_isActive_idx" ON "CollaborationRoom"("isActive");

-- AddForeignKey
ALTER TABLE "CollaborationRoom" ADD CONSTRAINT "CollaborationRoom_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationRoom" ADD CONSTRAINT "CollaborationRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
