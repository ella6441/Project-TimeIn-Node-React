import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'TimeIn Platform' })
  @IsString()
  projectName: string;

  @ApiPropertyOptional({ example: 'Work hours tracking system' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
    default: 'ACTIVE',
  })
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'uuid-of-manager' })
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ example: 'clickup-list-id' })
  @IsString()
  @IsOptional()
  externalClickUpListId?: string;

  @ApiPropertyOptional({ example: 'https://github.com/org/repo' })
  @IsString()
  @IsOptional()
  gitRepositoryUrl?: string;
}
