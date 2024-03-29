export class LeaveRoomAction {
  static KEY = "leave-room";

  public static getRandomExit(room: Room): ExitConstant | null {
    if (!room.memory.exits) {
      return null;
    }
    const directions = new Array<ExitConstant>();
    if (room.memory.exits[FIND_EXIT_TOP]) {
      directions.push(FIND_EXIT_TOP);
    }
    if (room.memory.exits[FIND_EXIT_BOTTOM]) {
      directions.push(FIND_EXIT_BOTTOM);
    }
    if (room.memory.exits[FIND_EXIT_LEFT]) {
      directions.push(FIND_EXIT_LEFT);
    }
    if (room.memory.exits[FIND_EXIT_RIGHT]) {
      directions.push(FIND_EXIT_RIGHT);
    }
    if (directions.length) {
      return directions[Math.floor(Math.random() * directions.length)];
    }
    return null;
  }

  public static moveIntoRoom(creep: Creep): void {
    if (creep.pos.x === 0) {
      creep.moveTo(1, creep.pos.y);
    } else if (creep.pos.x === 49) {
      creep.moveTo(48, creep.pos.y);
    } else if (creep.pos.y === 0) {
      creep.moveTo(creep.pos.x, 1);
    } else if (creep.pos.y === 49) {
      creep.moveTo(creep.pos.x, 48);
    }
  }

  public static moveOutOfRoom(creep: Creep): void {
    if (creep.pos.x === 1) {
      creep.moveTo(0, creep.pos.y);
    } else if (creep.pos.x === 48) {
      creep.moveTo(49, creep.pos.y);
    } else if (creep.pos.y === 1) {
      creep.moveTo(creep.pos.x, 0);
    } else if (creep.pos.y === 48) {
      creep.moveTo(creep.pos.x, 49);
    }
  }

  public static run(creep: Creep): void {
    if (!creep.memory.fromRoom) {
      creep.memory.fromRoom = creep.room.name;
    }
    if (!creep.memory.toRoom || creep.memory.toRoom === creep.room.name) {
      LeaveRoomAction.moveIntoRoom(creep);
      delete creep.memory.destination;
      delete creep.memory.toRoom;
      creep.setNextAction();
    } else if (creep.memory.fromRoom !== creep.room.name) {
      LeaveRoomAction.moveIntoRoom(creep);
      delete creep.memory.destination;
      creep.memory.fromRoom = creep.room.name;
      creep.memory.endRoom = creep.memory.toRoom;
      const route: Array<{ exit: ExitConstant; room: string }> | ERR_NO_PATH = Game.map.findRoute(
        creep.room,
        creep.memory.endRoom
      );
      if (route && route !== ERR_NO_PATH && route.length) {
        creep.memory.toRoom = route[0].room;
        const destination = creep.pos.findClosestByPath(route[0].exit);
        if (destination !== null) {
          creep.memory.destination = destination;
          creep.moveToTarget();
        }
      }
      creep.memory.action = "traveling";
      if (Memory.debug) {
        creep.say("✈ traveling");
      }
      creep.runAction();
    } else {
      LeaveRoomAction.moveOutOfRoom(creep);
      creep.moveToTarget();
    }
  }

  public static setAction(creep: Creep, direction: ExitConstant | null): void {
    creep.memory.fromRoom = creep.room.name;
    if (!direction) {
      direction = LeaveRoomAction.getRandomExit(creep.room);
    }
    if (!direction) {
      return;
    }
    let exitPoint = creep.pos.findClosestByPath(direction);
    if (!exitPoint || creep.room.memory.exits === undefined || !creep.room.memory.exits[direction]) {
      direction = LeaveRoomAction.getRandomExit(creep.room);
      if (direction && creep.room.memory.exits !== undefined && creep.room.memory.exits[direction]) {
        exitPoint = creep.pos.findClosestByPath(direction);
      }
    }

    if (exitPoint !== null && direction !== null) {
      creep.memory.destination = exitPoint;
      creep.memory.toRoom = creep.room.getAdjacentRoomName(direction);
      creep.memory.endRoom = creep.memory.toRoom;
      creep.memory.originRoom = creep.room.name;
      creep.memory.action = this.KEY;
      if (Memory.debug) {
        switch (direction) {
          case FIND_EXIT_BOTTOM:
            creep.say("☟ bye");
            break;
          case FIND_EXIT_TOP:
            creep.say("☝ bye");
            break;
          case FIND_EXIT_LEFT:
            creep.say("☜ bye");
            break;
          case FIND_EXIT_RIGHT:
          default:
            creep.say("☞ bye");
            break;
        }
      }
    }
  }
}
