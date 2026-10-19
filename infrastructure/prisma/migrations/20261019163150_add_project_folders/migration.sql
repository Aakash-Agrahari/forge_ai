-- CreateTable
CREATE TABLE "ProjectFolder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectFolder_projectId_idx" ON "ProjectFolder"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFolder_projectId_path_key" ON "ProjectFolder"("projectId", "path");

-- AddForeignKey
ALTER TABLE "ProjectFolder" ADD CONSTRAINT "ProjectFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
