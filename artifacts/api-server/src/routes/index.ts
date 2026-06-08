import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import dashboardRouter from "./dashboard";
import childrenCheckinRouter from "./children-checkin";
import membersRouter from "./members";
import eventsRouter from "./events";
import attendanceRouter from "./attendance";
import givingRouter from "./giving";
import settingsRouter from "./settings";
import memberHouseholdRouter from "./member-household";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(dashboardRouter);
router.use(childrenCheckinRouter);
router.use(membersRouter);
router.use(eventsRouter);
router.use(attendanceRouter);
router.use(givingRouter);
router.use(settingsRouter);
router.use(memberHouseholdRouter);

export default router;
