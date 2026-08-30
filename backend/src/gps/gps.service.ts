import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DistanceResult {
  originAddress: string;
  destinationAddress: string;
  distanceKm: number;
  durationMinutes: number;
}

export interface RoutePoint {
  location: string;
  lat?: number;
  lng?: number;
}

@Injectable()
export class GpsService {
  private readonly logger = new Logger(GpsService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY', '');
  }

  async calculateDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<DistanceResult> {
    if (!this.apiKey) {
      // Fallback: Haversine formula for straight-line distance
      const distance = this.haversineDistance(originLat, originLng, destLat, destLng);
      const estimatedRoadDistance = distance * 1.3; // Rough road factor
      return {
        originAddress: `${originLat},${originLng}`,
        destinationAddress: `${destLat},${destLng}`,
        distanceKm: Math.round(estimatedRoadDistance * 100) / 100,
        durationMinutes: Math.round((estimatedRoadDistance / 80) * 60), // ~80 km/h avg
      };
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json() as any;

      if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
        const element = data.rows[0].elements[0];
        return {
          originAddress: data.origin_addresses?.[0] || `${originLat},${originLng}`,
          destinationAddress: data.destination_addresses?.[0] || `${destLat},${destLng}`,
          distanceKm: Math.round((element.distance.value / 1000) * 100) / 100,
          durationMinutes: Math.round(element.duration.value / 60),
        };
      }

      this.logger.warn('Google Maps API returned non-OK status', data);
      return this.fallbackDistance(originLat, originLng, destLat, destLng);
    } catch (error) {
      this.logger.error('Google Maps API call failed', error);
      return this.fallbackDistance(originLat, originLng, destLat, destLng);
    }
  }

  async planRoute(waypoints: RoutePoint[]): Promise<{
    totalDistanceKm: number;
    totalDurationMinutes: number;
    legs: DistanceResult[];
  }> {
    const legs: DistanceResult[] = [];
    let totalDistanceKm = 0;
    let totalDurationMinutes = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const origin = waypoints[i];
      const dest = waypoints[i + 1];

      if (origin.lat && origin.lng && dest.lat && dest.lng) {
        const leg = await this.calculateDistance(origin.lat, origin.lng, dest.lat, dest.lng);
        legs.push(leg);
        totalDistanceKm += leg.distanceKm;
        totalDurationMinutes += leg.durationMinutes;
      }
    }

    return { totalDistanceKm, totalDurationMinutes, legs };
  }

  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private fallbackDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): DistanceResult {
    const distance = this.haversineDistance(originLat, originLng, destLat, destLng);
    const estimatedRoadDistance = distance * 1.3;
    return {
      originAddress: `${originLat},${originLng}`,
      destinationAddress: `${destLat},${destLng}`,
      distanceKm: Math.round(estimatedRoadDistance * 100) / 100,
      durationMinutes: Math.round((estimatedRoadDistance / 80) * 60),
    };
  }
}
