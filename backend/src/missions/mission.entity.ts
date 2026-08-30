import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { MissionStatus } from '../common/enums';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Driver } from '../drivers/driver.entity';
import { MissionZone } from '../mission-zones/mission-zone.entity';
import { MissionWaypoint } from '../mission-waypoints/mission-waypoint.entity';

@Entity('missions')
export class Mission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mission_number', unique: true })
  missionNumber: string;

  @Column({ name: 'vehicle_id' })
  vehicleId: string;

  @ManyToOne(() => Vehicle, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'driver_id' })
  driverId: string;

  @ManyToOne(() => Driver, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ type: 'enum', enum: MissionStatus, default: MissionStatus.PLANIFIEE })
  status: MissionStatus;

  @Column({ name: 'departure_location' })
  departureLocation: string;

  @Column({ name: 'departure_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  departureLat: number;

  @Column({ name: 'departure_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  departureLng: number;

  @Column({ name: 'arrival_location' })
  arrivalLocation: string;

  @Column({ name: 'arrival_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  arrivalLat: number;

  @Column({ name: 'arrival_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  arrivalLng: number;

  @Column({ name: 'planned_departure_date', type: 'timestamp' })
  plannedDepartureDate: Date;

  @Column({ name: 'actual_departure_date', type: 'timestamp', nullable: true })
  actualDepartureDate: Date;

  @Column({ name: 'planned_arrival_date', type: 'timestamp' })
  plannedArrivalDate: Date;

  @Column({ name: 'actual_arrival_date', type: 'timestamp', nullable: true })
  actualArrivalDate: Date;

  @Column({ name: 'planned_distance_km', type: 'decimal', precision: 10, scale: 2, nullable: true })
  plannedDistanceKm: number;

  @Column({ name: 'actual_distance_km', type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualDistanceKm: number;

  @Column({ name: 'gps_distance_km', type: 'decimal', precision: 10, scale: 2, nullable: true })
  gpsDistanceKm: number;

  @Column({ name: 'fuel_level_departure', type: 'decimal', precision: 5, scale: 2, nullable: true })
  fuelLevelDeparture: number;

  @Column({ name: 'fuel_level_arrival', type: 'decimal', precision: 5, scale: 2, nullable: true })
  fuelLevelArrival: number;

  @Column({ name: 'zone_id', nullable: true })
  zoneId: string;

  @ManyToOne(() => MissionZone, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'zone_id' })
  zone: MissionZone;

  @OneToMany(() => MissionWaypoint, (waypoint) => waypoint.mission, { cascade: true })
  waypoints: MissionWaypoint[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
