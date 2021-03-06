import * as _ from "lodash";
import { AttackAction } from "./actions/attack";
import { BuildAction } from "./actions/build";
import { Builder } from "./roles/builder";
import { ClaimControllerAction } from "./actions/claim-controller";
import { Claimer } from "./roles/claimer";
import { CreepRoleEnum } from "./roles/creep-role-enum";
import { LeaveRoomAction } from "./actions/leave-room";
import { Melee } from "./roles/melee";
import { MineEnergyAction } from "./actions/mine-energy";
import { Miner } from "./roles/miner";
import { MoveAction } from "./actions/move";
import { PickupAction } from "./actions/pickup";
import { RepairAction } from "./actions/repair";
import { ReserveControllerAction } from "./actions/reserve-controller";
import { TransferAction } from "./actions/transfer";
import { Transport } from "./roles/transport";
import { Traveler } from "./roles/traveler";
import { TravelingAction } from "./actions/traveling";
import { UpgradeControllerAction } from "./actions/upgrade-controller";
import { Upgrader } from "./roles/upgrader";
import { WaitAction } from "./actions/wait";
import { WithdrawAction } from "./actions/withdraw";

const moveToTarget = function (this: Creep) {
  LeaveRoomAction.moveIntoRoom(this);
  if (this.fatigue > 0) {
    return;
  }
  let moveMessage;
  if (this.memory.destination) {
    moveMessage = this.moveTo(this.memory.destination.x, this.memory.destination.y, {
      reusePath: 999,
      maxRooms: 1
    });
  } else if (this.memory.target) {
    const roomObject: RoomObject = Game.getObjectById(this.memory.target) as unknown as RoomObject;
    if (roomObject && roomObject.pos) {
      moveMessage = this.moveTo(roomObject.pos, { reusePath: 999, maxRooms: 1 });
    } else {
      delete this.memory.target;
    }
  } else {
    return;
  }
  if (moveMessage !== ERR_TIRED) {
    if (this.memory.prevPos && this.memory.prevPos.x === this.pos.x && this.memory.prevPos.y === this.pos.y) {
      delete this.memory.prevPos;
      delete this.memory._move;
      this.moveToTarget();
    } else {
      this.memory.prevPos = this.pos;
    }
  }
};

const goGetEnergy = function (this: Creep, hasWorkComponent: boolean, findHighest: boolean) {
  let closestContainer: Structure[] | Structure | null = null;
  if (findHighest) {
    if (this.room.memory && !this.room.memory.ccontainer && this.room.controller) {
      let closestControllerContainer: StructureContainer | null = null;
      let closestDistance = 99;
      _.forEach(
        this.room.find(FIND_STRUCTURES, {
          filter: (s: Structure) => {
            return s.structureType === STRUCTURE_CONTAINER;
          }
        }),
        (s: StructureContainer) => {
          if (!this.room.controller) {
            return;
          }
          const distance = s.pos.getRangeTo(this.room.controller.pos);
          if (!closestControllerContainer || distance < closestDistance) {
            closestControllerContainer = s;
            closestDistance = distance;
          }
        }
      );
      if (closestControllerContainer && closestDistance < 5) {
        this.room.memory.ccontainer = (closestControllerContainer as StructureContainer).id;
      }
    }
    closestContainer = _.sortBy(
      this.room.find(FIND_STRUCTURES, {
        filter: (s: Structure) => {
          return (
            (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
            (s as StructureContainer).store.energy > 0 &&
            (!this.room.memory.ccontainer || s.id !== this.room.memory.ccontainer)
          );
        }
      }),
      (s: StructureContainer) => {
        return -1 * s.store.energy;
      }
    );
    if (closestContainer.length > 0) {
      closestContainer = closestContainer[0];
    } else {
      closestContainer = _.sortBy(
        this.room.find(FIND_STRUCTURES, {
          filter: (s: StructureLink) => {
            return (
              s.structureType === STRUCTURE_LINK &&
              s.store.energy > 0 &&
              (s.room.memory.closestLink == null || s.room.memory.closestLink !== s.id)
            );
          }
        }),
        (s: StructureLink) => {
          return -1 * s.store.energy;
        }
      );
      if (closestContainer.length > 0) {
        closestContainer = closestContainer[0];
      } else {
        closestContainer = null;
      }
    }
  } else {
    closestContainer = this.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: (s: StructureContainer) => {
        return (
          (s.structureType === STRUCTURE_CONTAINER ||
            s.structureType === STRUCTURE_STORAGE ||
            s.structureType === STRUCTURE_LINK) &&
          s.store.energy > 0
        );
      }
    });
  }
  if (closestContainer != null) {
    WithdrawAction.setAction(this, closestContainer, RESOURCE_ENERGY);
  } else {
    if (hasWorkComponent) {
      MineEnergyAction.setAction(this);
    } else {
      const closestDroppedEnergy: Resource[] = this.room.find(FIND_DROPPED_RESOURCES);
      if (closestDroppedEnergy.length > 0 && closestDroppedEnergy[0].resourceType === RESOURCE_ENERGY) {
        PickupAction.setAction(this, closestDroppedEnergy[0]);
      } else {
        const closestTombstone: Tombstone[] = this.room.find(FIND_TOMBSTONES);
        if (closestTombstone.length > 0 && closestTombstone[0].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          WithdrawAction.setAction(this, closestTombstone[0], RESOURCE_ENERGY);
        } else {
          WaitAction.setActionUntilNextTick(this);
        }
      }
    }
  }
};

const deliverEnergyToSpawner = function (this: Creep) {
  const towerContainer = this.pos.findClosestByRange(FIND_STRUCTURES, {
    filter: (s: StructureTower) => {
      return s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    }
  });
  if (towerContainer) {
    TransferAction.setAction(this, towerContainer, RESOURCE_ENERGY);
    return;
  }
  const spawnerContainer = this.pos.findClosestByRange(FIND_STRUCTURES, {
    filter: (s: StructureExtension) => {
      return (
        (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      );
    }
  });
  if (spawnerContainer) {
    TransferAction.setAction(this, spawnerContainer, RESOURCE_ENERGY);
  } else {
    const mostEmptyContainer = _.sortBy(
      this.room.find(FIND_STRUCTURES, {
        filter: (s: StructureContainer) => {
          return (
            (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
            (s.room.memory.closestLink == null || s.room.memory.closestLink !== s.id)
          );
        }
      }),
      (s: StructureContainer) => {
        return s.store.energy;
      }
    );
    if (mostEmptyContainer.length) {
      TransferAction.setAction(this, mostEmptyContainer[0], RESOURCE_ENERGY);
    } else {
      this.room.reassignIdleCreep(this);
    }
  }
};

const setNextAction = function (this: Creep) {
  if (!this.memory.actionSwitched) {
    this.memory.actionSwitched = true;
  } else {
    return;
  }
  delete this.memory.fromRoom;
  delete this.memory.originRoom;
  delete this.memory.toRoom;
  delete this.memory.destination;
  switch (this.memory.role) {
    case Claimer.KEY:
      Claimer.setAction(this);
      break;
    case Traveler.KEY:
      Traveler.setAction(this);
      break;
    case Transport.KEY:
      Transport.setAction(this);
      break;
    case Builder.KEY:
      Builder.setAction(this);
      break;
    case Miner.KEY:
      Miner.setAction(this);
      break;
    case CreepRoleEnum.MELEE:
      Melee.setAction(this);
      break;
    case Upgrader.KEY:
    default:
      Upgrader.setAction(this);
      break;
  }
};

const runAction = function (this: Creep) {
  switch (this.memory.action) {
    case MoveAction.KEY:
      MoveAction.run(this);
      break;
    case AttackAction.KEY:
      AttackAction.run(this);
      break;
    case TravelingAction.KEY:
      TravelingAction.run(this);
      break;
    case LeaveRoomAction.KEY:
      LeaveRoomAction.run(this);
      break;
    case ClaimControllerAction.KEY:
      ClaimControllerAction.run(this);
      break;
    case ReserveControllerAction.KEY:
      ReserveControllerAction.run(this);
      break;
    case PickupAction.KEY:
      PickupAction.run(this);
      break;
    case RepairAction.KEY:
      RepairAction.run(this);
      break;
    case UpgradeControllerAction.KEY:
      UpgradeControllerAction.run(this);
      break;
    case BuildAction.KEY:
      BuildAction.run(this);
      break;
    case TransferAction.KEY:
      TransferAction.run(this);
      break;
    case WithdrawAction.KEY:
      WithdrawAction.run(this);
      break;
    case MineEnergyAction.KEY:
      MineEnergyAction.run(this);
      break;
    case WaitAction.KEY:
      WaitAction.run(this);
      break;
    default:
      this.setNextAction();
      break;
  }
};

declare global {
  interface Creep {
    moveToTarget();
    goGetEnergy(hasWorkComponent: boolean, findHighest: boolean);
    deliverEnergyToSpawner();
    setNextAction();
    runAction();
    init: boolean;
  }
}

export class CreepPrototype {
  public static init(): void {
    if (!Creep.hasOwnProperty("init")) {
      Creep.prototype.moveToTarget = moveToTarget;
      Creep.prototype.goGetEnergy = goGetEnergy;
      Creep.prototype.deliverEnergyToSpawner = deliverEnergyToSpawner;
      Creep.prototype.setNextAction = setNextAction;
      Creep.prototype.runAction = runAction;
      Creep.prototype.init = true;
    }
  }
}
