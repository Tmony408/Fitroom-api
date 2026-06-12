import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { FitProfilesService } from './fit-profiles.service';
import { CreateFitProfileDto } from './dto/create-fit-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('fit-profiles')
export class FitProfilesController {
  constructor(private readonly profiles: FitProfilesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFitProfileDto) {
    return this.profiles.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.profiles.list(user.id);
  }

  @Get('latest')
  latest(@CurrentUser() user: AuthUser) {
    return this.profiles.getLatest(user.id);
  }

  @Delete()
  deleteAll(@CurrentUser() user: AuthUser) {
    return this.profiles.deleteAll(user.id);
  }
}
