-- CreateTable
CREATE TABLE "PortIntel" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "lastVisitedTick" INTEGER NOT NULL,
    "market" JSONB NOT NULL,

    CONSTRAINT "PortIntel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortIntel_worldId_idx" ON "PortIntel"("worldId");

-- CreateIndex
CREATE UNIQUE INDEX "PortIntel_worldId_portId_key" ON "PortIntel"("worldId", "portId");

-- AddForeignKey
ALTER TABLE "PortIntel" ADD CONSTRAINT "PortIntel_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "GameWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;
