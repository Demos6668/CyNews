import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import newsRouter from "./news";
import advisoriesRouter from "./advisories";
import threatsRouter from "./threats";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(newsRouter);
router.use(advisoriesRouter);
router.use(threatsRouter);
router.use(searchRouter);

export default router;
