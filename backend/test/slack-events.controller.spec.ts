import { describe, expect, it, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { SlackEventsController } from '../src/slack/slack-events.controller.js';

describe('SlackEventsController', () => {
  it('url_verification: returns challenge token directly with HTTP 200', () => {
    const eventsService = { handle: vi.fn() };
    const controller = new SlackEventsController(eventsService as any);

    const json = vi.fn();
    const status = vi.fn(() => ({ json })) as any;
    const res = { status } as unknown as Response;

    controller.events(
      { type: 'url_verification', challenge: 'test-challenge-token' },
      undefined,
      res,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(json).toHaveBeenCalledWith({ challenge: 'test-challenge-token' });
    expect(eventsService.handle).not.toHaveBeenCalled();
  });

  it('event_callback: acknowledges with HTTP 200 end() and dispatches to eventsService', () => {
    const eventsService = { handle: vi.fn() };
    const controller = new SlackEventsController(eventsService as any);

    const end = vi.fn();
    const status = vi.fn(() => ({ end })) as any;
    const res = { status } as unknown as Response;

    const payload = {
      type: 'event_callback',
      team_id: 'T123',
      event: { type: 'app_mention' },
    };

    controller.events(payload as any, undefined, res);

    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(end).toHaveBeenCalled();
    expect(eventsService.handle).toHaveBeenCalledWith(payload);
  });

  it('slack retry header present: acknowledges with 200 end() and skips duplicate handling', () => {
    const eventsService = { handle: vi.fn() };
    const controller = new SlackEventsController(eventsService as any);

    const end = vi.fn();
    const status = vi.fn(() => ({ end })) as any;
    const res = { status } as unknown as Response;

    controller.events(
      { type: 'event_callback', team_id: 'T123' } as any,
      '1',
      res,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(end).toHaveBeenCalled();
    expect(eventsService.handle).not.toHaveBeenCalled();
  });
});
