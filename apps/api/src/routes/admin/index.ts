import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import users from './users';
import projectTypes from './projectTypes';
import templates from './templates';

const router = Router();

// Вся админка — только для pmo_admin
router.use(requireRole('pmo_admin'));
router.use('/users', users);
router.use('/project-types', projectTypes);
router.use('/templates', templates);

export default router;
