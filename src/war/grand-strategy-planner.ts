import * as _ from "lodash";
import { Util } from "../utils/util";

export class GrandStrategyPlanner {
  public static getBestRoomToClaim(room: Room, reserve: boolean): string | null {
    let mostSources = 0;
    let mostSpots = 0;
    let bestRoom: string | null = null;
    _.forEach(Memory.roomData, (roomData: GlobalRoomMemory | undefined, key) => {
      if (!key || !Memory.username) {
        return;
      }
      const currentRoom: Room = Game.rooms[key];
      if (currentRoom && (!currentRoom.controller || currentRoom.controller.my)) {
        return;
      }
      if (currentRoom && reserve && GrandStrategyPlanner.canReserve(Memory.username, currentRoom)) {
        return;
      }
      if (room && GrandStrategyPlanner.getDistanceBetweenTwoRooms(room.name, key) > 3) {
        return;
      }
      let numberOfSources = 0;
      let numberOfSpots = 0;
      const rData: GlobalRoomMemory | undefined = Memory.roomData[key] as GlobalRoomMemory;
      if (rData !== undefined && rData.sources) {
        numberOfSources = rData.sources.qty ? rData.sources.qty : 0;
        numberOfSpots = rData.sources.spots ? rData.sources.spots : 0;
      }

      if (numberOfSources > mostSources || (numberOfSources === mostSources && mostSpots > numberOfSpots)) {
        bestRoom = key;
        mostSpots = numberOfSpots;
        mostSources = numberOfSources;
      }
    });
    return bestRoom;
  }

  public static canClaimAnyRoom(): boolean {
    const numberOfOwnedRooms = _.filter(Game.rooms, r => {
      return r.controller && r.controller.my;
    }).length;
    return Game.gcl.level > numberOfOwnedRooms;
  }

  public static canReserve(username: string, room: Room): boolean {
    return <boolean>(
      (room.controller &&
        (!room.controller.reservation || room.controller.reservation.username === username) &&
        !room.controller.my &&
        !room.controller.owner)
    );
  }

  public static findNewTravelerHomeRoom(creep: Creep): string | null {
    let helpRoom: string | null = null;
    let leastEnergy = 99999;
    _.forEach(Game.rooms, (room: Room) => {
      if (room.name === creep.memory.endRoom) {
        return;
      }
      if (!room.controller || !room.controller.my) {
        return;
      }
      if (this.getDistanceBetweenTwoRooms(room.name, creep.room.name) > 4) {
        return;
      }
      if (leastEnergy > room.energyAvailable) {
        leastEnergy = room.energyAvailable;
        helpRoom = room.name;
      }
    });
    return helpRoom;
  }

  public static cleanupTravelerArray(roomName: string): void {
    if (!Memory.roomData) {
      Memory.roomData = {} as Map<string, GlobalRoomMemory>;
    }
    if (!Memory.roomData[roomName]) {
      Memory.roomData[roomName] = {} as GlobalRoomMemory;
    }
    if (!(Memory.roomData[roomName] as GlobalRoomMemory).travelers) {
      (Memory.roomData[roomName] as GlobalRoomMemory).travelers = new Array<Id<_HasId>>();
    }
    if (!(Memory.roomData[roomName] as GlobalRoomMemory).defenders) {
      (Memory.roomData[roomName] as GlobalRoomMemory).defenders = new Array<Id<_HasId>>();
    }
    (Memory.roomData[roomName] as GlobalRoomMemory).travelers = (
      Memory.roomData[roomName] as GlobalRoomMemory
    ).travelers.filter((id: Id<_HasId>) => {
      return Game.getObjectById(id) !== null;
    });
    (Memory.roomData[roomName] as GlobalRoomMemory).defenders = (
      Memory.roomData[roomName] as GlobalRoomMemory
    ).defenders.filter((id: Id<_HasId>) => {
      return Game.getObjectById(id) !== null;
    });
  }

  public static findTravelerDestinationRoom(roomName: string, creep: Creep | null): string | null {
    if (creep && creep.memory.travel) {
      return creep.memory.travel;
    }
    let helpRoom: string | null = null;
    const currentRoom = Game.rooms[roomName];
    if (!currentRoom) {
      return null;
    }
    if (currentRoom.memory.travelerRoom) {
      helpRoom = currentRoom.memory.travelerRoom;
      if (creep) {
        delete currentRoom.memory.travelerRoom;
      }
      return helpRoom;
    }
    helpRoom = this.findHelpRoom(creep, roomName, currentRoom);
    if (helpRoom && !creep) {
      currentRoom.memory.travelerRoom = helpRoom;
    }
    if (helpRoom !== null && creep) {
      delete currentRoom.memory.travelerRoom;
      console.log("sending traveler " + creep.id + " to " + <string>(<unknown>helpRoom) + " from " + roomName);
      creep.memory.travel = helpRoom;
      (<GlobalRoomMemory>Memory.roomData[helpRoom]).travelers.push(creep.id);
    }
    return helpRoom;
  }

  private static findHelpRoom(creep: Creep | null, roomName: string, currentRoom: Room) {
    let helpRoom: string | null = null;
    let highestEnergyAvailable = 0;
    _.forEach(Memory.roomData, (roomData: GlobalRoomMemory, key) => {
      if (!key || roomName === key) {
        return;
      }
      const room: Room = Game.rooms[key];
      if (creep && key === creep.memory.endRoom) {
        return;
      }
      let numberOfSpots = 0;
      if (roomData.sources && roomData.sources.spots) {
        numberOfSpots = roomData.sources.spots;
      }
      GrandStrategyPlanner.cleanupTravelerArray(key);
      const roomDistance = GrandStrategyPlanner.getDistanceBetweenTwoRooms(key, roomName);
      const controllerLevel = currentRoom.controller ? currentRoom.controller.level : 0;

      // If a room I own doesn't have enough creeps, send travelers to help
      if (
        room &&
        roomDistance < 8 &&
        roomData.travelers.length - 4 < Math.max(5, numberOfSpots) &&
        room.controller &&
        room.controller.my &&
        (room.controller.level < 4 || room.memory.sendBuilders) &&
        !room.controller.reservation
      ) {
        helpRoom = room.name;
        return;
      }
      // Send travelers to reserved rooms, sendBuilder rooms, or mining status rooms

      let roomIsOneRoomAway = false;
      const miningRoom =
        (room &&
          room.controller &&
          room.controller.reservation &&
          room.controller.reservation.username === Memory.username) ||
        roomData.status === "mine";
      if (miningRoom && controllerLevel > 3 && !currentRoom.memory.sendBuilders) {
        return;
      }
      if (miningRoom) {
        const exit = currentRoom.findExitTo(key);
        if (
          exit &&
          (exit === FIND_EXIT_BOTTOM || exit === FIND_EXIT_LEFT || exit === FIND_EXIT_RIGHT || exit === FIND_EXIT_TOP)
        ) {
          const isWest = roomName.indexOf("W") !== -1;
          const isNorth = roomName.indexOf("N") !== -1;
          const splitName = roomName.slice(1).split(isNorth ? "N" : "S");
          const x = Number(splitName[0]);
          const y = Number(splitName[1]);
          const roomExit = Util.getRoomKey(exit, isWest, isNorth, x, y);
          roomIsOneRoomAway = roomExit === key;
        }
      }

      if (
        (miningRoom && roomDistance < 2 && roomIsOneRoomAway) ||
        (roomDistance < 3 && room && room.memory.sendBuilders)
      ) {
        const energyAvailable = this.countEnergyAvailableInContainers(room);
        if (
          !GrandStrategyPlanner.hasHostilesInRoom(key) &&
          (roomData.travelers.length - 4 < Math.max(2, numberOfSpots) ||
            (energyAvailable > 500 && roomData.travelers.length - 6 < Math.max(2, numberOfSpots)))
        ) {
          if (energyAvailable > highestEnergyAvailable) {
            highestEnergyAvailable = energyAvailable;
            helpRoom = key;
          }
        }
      }
    });
    return helpRoom;
  }

  public static countEnergyAvailableInContainers(room: Room, countLinks?: boolean): number {
    let energyInContainers = 0;
    if (room) {
      _.forEach(
        room.find(FIND_STRUCTURES, {
          filter: (s: Structure) => {
            return (
              s.structureType === STRUCTURE_CONTAINER ||
              (countLinks && (s.structureType === STRUCTURE_LINK || s.structureType === STRUCTURE_STORAGE))
            );
          }
        }),
        (s: StructureContainer) => {
          energyInContainers += s.store.getUsedCapacity(RESOURCE_ENERGY);
        }
      );
    }
    return energyInContainers;
  }

  public static hasHostilesInRoom(roomName: string): boolean {
    const room = Game.rooms[roomName];
    return (
      (room &&
        (room.find(FIND_HOSTILE_CREEPS).length > 0 ||
          room.find(FIND_HOSTILE_POWER_CREEPS).length > 0 ||
          room.find(FIND_HOSTILE_STRUCTURES, {
            filter: (s: Structure) => {
              return s.structureType !== STRUCTURE_POWER_BANK;
            }
          }).length > 0)) ||
      (!room &&
        ((Memory.roomData[roomName] as GlobalRoomMemory).hostileMelee > 0 ||
          (Memory.roomData[roomName] as GlobalRoomMemory).hostileHealer > 0 ||
          (Memory.roomData[roomName] as GlobalRoomMemory).hostilePowerCreeps > 0 ||
          (Memory.roomData[roomName] as GlobalRoomMemory).hostileStructures > 0 ||
          (Memory.roomData[roomName] as GlobalRoomMemory).hostileRanged > 0))
    );
  }

  public static getDistanceBetweenTwoRooms(room1Name: string, room2Name: string): number {
    // TODO make this take exits into account?
    const is1West = room1Name.indexOf("W") !== -1;
    const is1North = room1Name.indexOf("N") !== -1;
    const split1Name = room1Name.slice(1).split(is1North ? "N" : "S");
    const x1 = Number(split1Name[0]);
    const y1 = Number(split1Name[1]);

    const is2West = room2Name.indexOf("W") !== -1;
    const is2North = room2Name.indexOf("N") !== -1;
    const split2Name = room2Name.slice(1).split(is2North ? "N" : "S");
    const x2 = Number(split2Name[0]);
    const y2 = Number(split2Name[1]);

    const verticalDistance = Math.abs(is1West === is2West ? x1 - x2 : x1 + x2);
    const horizontalDistance = Math.abs(is1North === is2North ? y1 - y2 : y1 + y2);
    return verticalDistance + horizontalDistance;
  }

  public static scanAllOccupiedRoomsForHostiles(): void {
    _.forEach(Memory.roomData, (roomData: GlobalRoomMemory, key) => {
      if (!key) {
        return;
      }
      const room = Game.rooms[key];
      if (!room) {
        return;
      }
      let ranged = 0;
      let melee = 0;
      let heal = 0;
      let creeps = 0;
      _.forEach(room.find(FIND_HOSTILE_CREEPS), (creep: Creep) => {
        if (
          _.filter(creep.body, (bodyPart: BodyPartDefinition) => {
            return bodyPart.type === ATTACK;
          }).length > 0
        ) {
          melee++;
        }
        if (
          _.filter(creep.body, (bodyPart: BodyPartDefinition) => {
            return bodyPart.type === RANGED_ATTACK;
          }).length > 0
        ) {
          ranged++;
        }
        if (
          _.filter(creep.body, (bodyPart: BodyPartDefinition) => {
            return bodyPart.type === HEAL;
          }).length > 0
        ) {
          heal++;
        }
        creeps++;
      });
      (Memory.roomData[key] as GlobalRoomMemory).hostileStructures = room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (s: Structure) => {
          return s.structureType !== STRUCTURE_POWER_BANK;
        }
      }).length;
      (Memory.roomData[key] as GlobalRoomMemory).hostilePowerCreeps = room.find(FIND_HOSTILE_POWER_CREEPS).length;
      (Memory.roomData[key] as GlobalRoomMemory).hostileRanged = ranged;
      (Memory.roomData[key] as GlobalRoomMemory).hostileHealer = heal;
      (Memory.roomData[key] as GlobalRoomMemory).hostileMelee = melee;
      (Memory.roomData[key] as GlobalRoomMemory).hostileWorkers = Math.max(0, creeps - ranged - heal - melee);
    });
  }

  public static findHostileRoom(roomName: string, creep: Creep | null): string | null {
    let hostileRoom: string | null = null;
    _.forEach(Memory.roomData, (roomData: GlobalRoomMemory, key) => {
      if (!key || !GrandStrategyPlanner.hasHostilesInRoom(key)) {
        return;
      }
      GrandStrategyPlanner.cleanupTravelerArray(key);
      if (GrandStrategyPlanner.getDistanceBetweenTwoRooms(key, roomName) > 8) {
        return;
      }
      const room = Game.rooms[key];
      const shouldDefendRoom = (room && room.controller && room.controller.my) || (room && roomData.status === "mine");
      if (
        !shouldDefendRoom &&
        ((Memory.roomData[key] as GlobalRoomMemory).hostileMelee > 0 ||
          (Memory.roomData[key] as GlobalRoomMemory).hostileRanged > 0 ||
          (Memory.roomData[key] as GlobalRoomMemory).hostileHealer > 0)
      ) {
        return;
      }
      if (room && room.controller && room.controller.safeMode) {
        return;
      }
      if (!shouldDefendRoom && (Memory.roomData[key] as GlobalRoomMemory).defenders.length > 8) {
        return;
      }
      hostileRoom = key;
    });
    if (hostileRoom !== null && creep !== null) {
      console.log("sending melee to " + <string>(<unknown>hostileRoom));
      (Memory.roomData[hostileRoom] as GlobalRoomMemory).defenders.push(creep.id);
    }
    return hostileRoom;
  }
}
