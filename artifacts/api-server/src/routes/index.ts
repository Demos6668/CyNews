import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import newsRouter from "./news";
import advisoriesRouter from "./advisories";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(newsRouter);
router.use(advisoriesRouter);
router.use(searchRouter);

export default router;
