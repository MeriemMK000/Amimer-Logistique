import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProposalService, ProposalCriteria } from './proposal.service';

@ApiTags('Proposal')
@Controller('proposals')
export class ProposalController {
  constructor(private readonly service: ProposalService) {}

  @Post()
  propose(@Body() body: ProposalCriteria) {
    return this.service.propose(body ?? {});
  }
}
