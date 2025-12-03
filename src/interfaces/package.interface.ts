// src/interfaces/Package.interface.ts

export interface Package {
    _id?: string; 
    name: string;
    duration: '1-Month' | '6-Month' | '12-Month';
    sessions: number;
    pricePerSlot: number; 
    totalPrice: number; 
    discount: number; 
    isGenesisEligible: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}