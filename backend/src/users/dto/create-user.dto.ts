import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Sarah Cohen' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'sarah@timein.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    enum: ['EMPLOYEE', 'MANAGER', 'ADMIN'],
    default: 'EMPLOYEE',
  })
  @IsIn(['EMPLOYEE', 'MANAGER', 'ADMIN'])
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: 'Backend Team' })
  @IsString()
  @IsOptional()
  team?: string;
}
