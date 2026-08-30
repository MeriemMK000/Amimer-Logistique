import { PartialType } from '@nestjs/swagger';
import { CreateExpenseScaleDto } from './create-expense-scale.dto';

export class UpdateExpenseScaleDto extends PartialType(CreateExpenseScaleDto) {}
