import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateMissionExpenseDto } from './create-mission-expense.dto';

export class UpdateMissionExpenseDto extends PartialType(
  OmitType(CreateMissionExpenseDto, ['missionId', 'driverId'] as const),
) {}
