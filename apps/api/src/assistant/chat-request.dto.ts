import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ChatRequestDto {
  @IsUUID('4')
  clientRequestId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  locale?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
