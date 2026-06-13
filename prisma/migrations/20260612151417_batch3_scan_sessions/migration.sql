-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSED', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "FitProfile" ADD COLUMN     "label" TEXT NOT NULL DEFAULT 'My measurements',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ScanSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "declaredHeightCm" INTEGER,
    "assets" JSONB NOT NULL DEFAULT '{}',
    "qualityResults" JSONB,
    "modelVersion" TEXT,
    "measurements" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanSession_userId_idx" ON "ScanSession"("userId");

-- CreateIndex
CREATE INDEX "ScanSession_expiresAt_idx" ON "ScanSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "ScanSession" ADD CONSTRAINT "ScanSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
