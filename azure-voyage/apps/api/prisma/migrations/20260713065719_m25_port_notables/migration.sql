-- CreateTable
CREATE TABLE "PortNotable" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portrait" TEXT NOT NULL,
    "archetype" TEXT NOT NULL,
    "persona" JSONB,

    CONSTRAINT "PortNotable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortNotable_worldId_portId_key" ON "PortNotable"("worldId", "portId");

-- AddForeignKey
ALTER TABLE "PortNotable" ADD CONSTRAINT "PortNotable_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "GameWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;
