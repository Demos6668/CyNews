import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import newsRouter from "./news";
import advisoriesRouter from "./advisories";
import threatsRouter from "./threats";
import searchRouter from "./search";
import exportRouter from "./export";
import workspacesRouter from "./workspaces";
import schedulerRouter from "./scheduler";

const router: IRouter = Router();

router.use(schedulerRouter);
router.use(healthRouter);
router.use(exportRouter);
router.use(workspacesRouter);
router.use(dashboardRouter);
router.use(newsRouter);
router.use(advisoriesRouter);
router.use(threatsRouter);
router.use(searchRouter);

export default router;
