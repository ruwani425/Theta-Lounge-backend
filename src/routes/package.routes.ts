// src/routes/Package.router.ts

import { Router } from 'express';
import { createPackage, updatePackage, getAllPackages } from '../controllers/package.controller';

const router: Router = Router();

// Route to get all packages (Active and Inactive) for Admin Dashboard
router.get('/all', getAllPackages); 

// Route to create a new package
router.post('/', createPackage);

// Route to update a package by ID (used for editing details AND toggling isActive)
router.put('/:id', updatePackage);

export default router;