import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Mission } from '../missions/mission.entity';

@Entity('mission_waypoints')
export class MissionWaypoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mission_id' })
  missionId: string;

  @ManyToOne(() => Mission, (mission) => mission.waypoints, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mission_id' })
  mission: Mission;

  @Column({ name: 'order' })
  order: number;

  @Column()
  location: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng: number;

  @Column({ name: 'planned_arrival', type: 'timestamp', nullable: true })
  plannedArrival: Date;

  @Column({ name: 'actual_arrival', type: 'timestamp', nullable: true })
  actualArrival: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
