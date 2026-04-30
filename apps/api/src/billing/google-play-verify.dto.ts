import { IsNotEmpty, IsString } from 'class-validator';

export class GooglePlayVerifyDto {
  @IsString()
  @IsNotEmpty()
  purchaseToken!: string;

  @IsString()
  @IsNotEmpty()
  productId!: string;
}
