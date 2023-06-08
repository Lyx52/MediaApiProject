
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as express from "express";
import * as bodyParser from 'body-parser'
@Injectable()
export class LivekitWebhookMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: () => any) {
        bodyParser.raw({type: '*/*'})(req, res, next);
    }
}
