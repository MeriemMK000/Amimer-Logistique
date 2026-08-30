import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { ExpenseScale } from './entities/expense-scale.entity';
import { MissionExpense } from './entities/mission-expense.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExpenseScale, MissionExpense])],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
