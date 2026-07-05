-- CreateEnum
CREATE TYPE "GuildKind" AS ENUM ('PLAYER', 'NPC', 'LOCAL');

-- CreateEnum
CREATE TYPE "FleetActivity" AS ENUM ('DOCKED', 'SAILING', 'ANCHORED', 'EXPLORING', 'IN_BATTLE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'RESOLVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('RULE', 'AI');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('ONGOING', 'PLAYER_WIN', 'PLAYER_LOSE', 'FLED');

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "kind" "GuildKind" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "gold" BIGINT NOT NULL DEFAULT 0,
    "fame" INTEGER NOT NULL DEFAULT 0,
    "aiPersona" JSONB,
    "aiStrategy" JSONB,
    "aiStrategyUpdatedTick" INTEGER,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fleet" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activity" "FleetActivity" NOT NULL DEFAULT 'DOCKED',
    "posQ" INTEGER NOT NULL,
    "posR" INTEGER NOT NULL,
    "dockedPortId" TEXT,
    "route" JSONB,
    "food" INTEGER NOT NULL DEFAULT 0,
    "water" INTEGER NOT NULL DEFAULT 0,
    "morale" INTEGER NOT NULL DEFAULT 70,

    CONSTRAINT "Fleet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ship" (
    "id" TEXT NOT NULL,
    "fleetId" TEXT NOT NULL,
    "shipClassId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hull" INTEGER NOT NULL,
    "sails" INTEGER NOT NULL DEFAULT 100,
    "crew" INTEGER NOT NULL,
    "isFlagship" BOOLEAN NOT NULL DEFAULT false,
    "fitting" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Ship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoSlot" (
    "id" TEXT NOT NULL,
    "shipId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "avgBuyPrice" INTEGER NOT NULL,

    CONSTRAINT "CargoSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Officer" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "fleetId" TEXT,
    "name" TEXT NOT NULL,
    "portrait" TEXT NOT NULL,
    "role" TEXT,
    "stats" JSONB NOT NULL,
    "skills" TEXT[],
    "loyalty" INTEGER NOT NULL DEFAULT 60,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "salary" INTEGER NOT NULL,
    "locationPortId" TEXT,
    "persona" JSONB,

    CONSTRAINT "Officer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortState" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "prosperity" INTEGER NOT NULL DEFAULT 50,
    "facilities" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "PortState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketStock" (
    "id" TEXT NOT NULL,
    "portStateId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "baseStock" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "priceHistory" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "MarketStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortInfluence" (
    "id" TEXT NOT NULL,
    "portStateId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "share" DECIMAL(5,2) NOT NULL,
    "goodwill" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "PortInfluence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldEvent" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "source" "EventSource" NOT NULL,
    "type" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "triggerTick" INTEGER NOT NULL,
    "expireTick" INTEGER,
    "payload" JSONB NOT NULL,
    "narrative" TEXT,

    CONSTRAINT "WorldEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "status" "BattleStatus" NOT NULL DEFAULT 'ONGOING',
    "seed" INTEGER NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "startedTick" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "actionLog" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRecord" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "discoveryId" TEXT NOT NULL,
    "foundTick" INTEGER NOT NULL,
    "registered" BOOLEAN NOT NULL DEFAULT false,
    "narrative" TEXT,

    CONSTRAINT "DiscoveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGenerationLog" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Guild_worldId_kind_idx" ON "Guild"("worldId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_worldId_name_key" ON "Guild"("worldId", "name");

-- CreateIndex
CREATE INDEX "Fleet_worldId_guildId_idx" ON "Fleet"("worldId", "guildId");

-- CreateIndex
CREATE INDEX "Fleet_worldId_activity_idx" ON "Fleet"("worldId", "activity");

-- CreateIndex
CREATE INDEX "Ship_fleetId_idx" ON "Ship"("fleetId");

-- CreateIndex
CREATE UNIQUE INDEX "CargoSlot_shipId_commodityId_key" ON "CargoSlot"("shipId", "commodityId");

-- CreateIndex
CREATE INDEX "Officer_worldId_fleetId_idx" ON "Officer"("worldId", "fleetId");

-- CreateIndex
CREATE INDEX "Officer_worldId_locationPortId_idx" ON "Officer"("worldId", "locationPortId");

-- CreateIndex
CREATE UNIQUE INDEX "PortState_worldId_portId_key" ON "PortState"("worldId", "portId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketStock_portStateId_commodityId_key" ON "MarketStock"("portStateId", "commodityId");

-- CreateIndex
CREATE UNIQUE INDEX "PortInfluence_portStateId_guildId_key" ON "PortInfluence"("portStateId", "guildId");

-- CreateIndex
CREATE INDEX "WorldEvent_worldId_status_triggerTick_idx" ON "WorldEvent"("worldId", "status", "triggerTick");

-- CreateIndex
CREATE INDEX "Battle_worldId_status_idx" ON "Battle"("worldId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryRecord_worldId_discoveryId_key" ON "DiscoveryRecord"("worldId", "discoveryId");

-- CreateIndex
CREATE INDEX "AiGenerationLog_worldId_kind_createdAt_idx" ON "AiGenerationLog"("worldId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "Guild" ADD CONSTRAINT "Guild_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "GameWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fleet" ADD CONSTRAINT "Fleet_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "GameWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fleet" ADD CONSTRAINT "Fleet_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ship" ADD CONSTRAINT "Ship_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoSlot" ADD CONSTRAINT "CargoSlot_shipId_fkey" FOREIGN KEY ("shipId") REFERENCES "Ship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Officer" ADD CONSTRAINT "Officer_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "GameWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Officer" ADD CONSTRAINT "Officer_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortState" ADD CONSTRAINT "PortState_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "GameWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketStock" ADD CONSTRAINT "MarketStock_portStateId_fkey" FOREIGN KEY ("portStateId") REFERENCES "PortState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortInfluence" ADD CONSTRAINT "PortInfluence_portStateId_fkey" FOREIGN KEY ("portStateId") REFERENCES "PortState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortInfluence" ADD CONSTRAINT "PortInfluence_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldEvent" ADD CONSTRAINT "WorldEvent_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "GameWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "GameWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryRecord" ADD CONSTRAINT "DiscoveryRecord_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "GameWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGenerationLog" ADD CONSTRAINT "AiGenerationLog_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "GameWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;
