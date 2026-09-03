import { describe, expect, it } from 'vitest'
import {
  BUFFER_SIZE,
  ERP_WIDTH,
  LANE_GAP,
  PROCESS_HEIGHT,
  PROCESS_WIDTH,
  ROW_Y,
  autoLayoutProcessPositions,
  bufferPosition,
  customerCloudPosition,
  erpBoxPosition,
  heijunkaBoxPosition,
  laneY,
  slotPosition,
  supplierCloudPosition,
} from './autoLayout'

describe('autoLayoutProcessPositions', () => {
  it('returns an empty map for no processes', () => {
    expect(autoLayoutProcessPositions([])).toEqual({})
  })

  it('places a single process at the start of the row', () => {
    const positions = autoLayoutProcessPositions(['p1'])
    expect(positions.p1.y).toBe(ROW_Y)
    expect(positions.p1.x).toBeGreaterThan(supplierCloudPosition().x)
  })

  it('spaces consecutive processes left-to-right with no overlap', () => {
    const positions = autoLayoutProcessPositions(['p1', 'p2', 'p3'])

    expect(positions.p2.x).toBeGreaterThanOrEqual(positions.p1.x + PROCESS_WIDTH)
    expect(positions.p3.x).toBeGreaterThanOrEqual(positions.p2.x + PROCESS_WIDTH)
    // all on the same row
    expect(positions.p1.y).toBe(positions.p2.y)
    expect(positions.p2.y).toBe(positions.p3.y)
  })

  it('is deterministic for the same input', () => {
    expect(autoLayoutProcessPositions(['a', 'b'])).toEqual(autoLayoutProcessPositions(['a', 'b']))
  })
})

describe('supplierCloudPosition / customerCloudPosition', () => {
  it('places the supplier cloud to the left of the first process', () => {
    const positions = autoLayoutProcessPositions(['p1'])
    expect(supplierCloudPosition().x).toBeLessThan(positions.p1.x)
  })

  it('places the customer cloud to the right of the last process', () => {
    const positions = autoLayoutProcessPositions(['p1', 'p2'])
    const lastX = positions.p2.x
    expect(customerCloudPosition(2).x).toBeGreaterThan(lastX + PROCESS_WIDTH)
  })

  it('moves the customer cloud further right as more processes are added', () => {
    expect(customerCloudPosition(5).x).toBeGreaterThan(customerCloudPosition(2).x)
  })
})

describe('laneY / slotPosition', () => {
  it('lane 0 sits on the main row', () => {
    expect(laneY(0)).toBe(ROW_Y)
  })

  it('each additional lane sits one process-height + gap further down', () => {
    expect(laneY(1)).toBe(ROW_Y + PROCESS_HEIGHT + LANE_GAP)
    expect(laneY(2)).toBe(ROW_Y + 2 * (PROCESS_HEIGHT + LANE_GAP))
  })

  it('never goes above the main row for a negative lane', () => {
    expect(laneY(-1)).toBe(ROW_Y)
  })

  it('slotPosition places sequence index 0 at the row start, on the given lane', () => {
    const pos = slotPosition(0, 1)
    expect(pos.x).toBe(autoLayoutProcessPositions(['only']).only.x)
    expect(pos.y).toBe(laneY(1))
  })

  it('spaces sequence slots the same way as autoLayoutProcessPositions', () => {
    const auto = autoLayoutProcessPositions(['a', 'b', 'c'])
    expect(slotPosition(0)).toEqual(auto.a)
    expect(slotPosition(1)).toEqual(auto.b)
    expect(slotPosition(2)).toEqual(auto.c)
  })
})

describe('heijunkaBoxPosition', () => {
  it('sits directly to the right of the ERP box, on the same row', () => {
    const erp = erpBoxPosition(3)
    const heijunka = heijunkaBoxPosition(3)

    expect(heijunka.x).toBeGreaterThan(erp.x + ERP_WIDTH)
    expect(heijunka.y).toBe(erp.y)
  })

  it('follows the ERP box as more processes are added, staying attached', () => {
    const erpFew = erpBoxPosition(2)
    const heijunkaFew = heijunkaBoxPosition(2)
    const erpMany = erpBoxPosition(6)
    const heijunkaMany = heijunkaBoxPosition(6)

    expect(heijunkaFew.x - erpFew.x).toBe(heijunkaMany.x - erpMany.x)
  })
})

describe('bufferPosition', () => {
  it('places buffer N between process N and process N+1', () => {
    const positions = autoLayoutProcessPositions(['p1', 'p2'])
    const buffer0 = bufferPosition(0)

    expect(buffer0.x).toBeGreaterThan(positions.p1.x)
    expect(buffer0.x).toBeLessThan(positions.p2.x)
  })

  it('vertically centers the buffer relative to the process row', () => {
    const buffer0 = bufferPosition(0)
    const processMidY = ROW_Y + PROCESS_HEIGHT / 2
    expect(buffer0.y + BUFFER_SIZE / 2).toBeCloseTo(processMidY, 0)
  })
})
