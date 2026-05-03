import { IsString, IsOptional, IsIn, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ enum: ['EMPLOYEE', 'MANAGER', 'ADMIN'] })
  @IsOptional()
  @IsIn(['EMPLOYEE', 'MANAGER', 'ADMIN'])
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  team?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'ID of the manager this user reports to',
  })
  @IsOptional()
  @IsString()
  managerId?: string | null;
}
