-- AlterTable
ALTER TABLE "Battle" ADD COLUMN     "fleetId" TEXT;

-- CreateIndex
CREATE INDEX "Battle_worldId_fleetId_status_idx" ON "Battle"("worldId", "fleetId", "status");
