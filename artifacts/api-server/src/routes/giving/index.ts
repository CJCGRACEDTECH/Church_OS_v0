import { Router, type IRouter } from "express";
import memberRouter from "./member";
import campaignsRouter from "./campaigns";
import adminDonationsRouter from "./admin-donations";
import reportsRouter from "./reports";
import unmatchedRouter from "./unmatched";
import aliasesRouter from "./aliases";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(memberRouter);
router.use(campaignsRouter);
router.use(adminDonationsRouter);
router.use(reportsRouter);
router.use(unmatchedRouter);
router.use(aliasesRouter);
router.use(webhooksRouter);

export default router;
