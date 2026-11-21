import type { RequestHandler } from "express";
import type { AnnounceBody, ClaimBody, SignupBody } from "./pairing.schemas.js";
import * as service from "./pairing.service.js";

const ipOf = (req: Parameters<RequestHandler>[0]) => req.ip ?? "";

export const announce: RequestHandler = async (req, res) => {
  res.json(await service.announce(ipOf(req), req.body as AnnounceBody));
};

export const available: RequestHandler = async (req, res) => {
  res.json({ devices: await service.available(ipOf(req)) });
};

export const claim: RequestHandler = async (req, res) => {
  const result = await service.claim(
    res.locals.userId as string,
    ipOf(req),
    req.body as ClaimBody,
  );
  res.status(201).json(result);
};

export const signup: RequestHandler = async (req, res) => {
  res.status(201).json(await service.signupAndClaim(ipOf(req), req.body as SignupBody));
};
