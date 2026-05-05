import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DevAdminGuard } from './dev-admin.guard';
import { DevAdminService } from './dev-admin.service';

@Controller('dev-admin/users')
@UseGuards(DevAdminGuard)
export class DevAdminController {
  constructor(private readonly devAdminService: DevAdminService) {}

  @Post()
  createUser(@Body() body: unknown) {
    return this.devAdminService.createUser(body);
  }

  @Patch(':userId')
  updateUser(@Param('userId') userId: string, @Body() body: unknown) {
    return this.devAdminService.updateUser(userId, body);
  }

  @Delete(':userId')
  deleteUser(@Param('userId') userId: string) {
    return this.devAdminService.deleteUser(userId);
  }

  @Post(':userId/subscription')
  setSubscription(@Param('userId') userId: string, @Body() body: unknown) {
    return this.devAdminService.setSubscription(userId, body);
  }
}
