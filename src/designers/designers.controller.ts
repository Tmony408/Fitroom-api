import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { DesignersService } from './designers.service';
import { CreateDesignerDto, UpdateDesignerDto } from './dto/designer.dto';

@Controller('designers')
export class DesignersController {
  constructor(private readonly designers: DesignersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDesignerDto) {
    return this.designers.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DESIGNER')
  @Get('me/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.designers.dashboard(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DESIGNER')
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateDesignerDto) {
    return this.designers.updateMe(user.id, dto);
  }

  // Public designer profile (storefront).
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.designers.getById(id);
  }
}
