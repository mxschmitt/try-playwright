import { expect, it, describe } from '@playwright/test';
import fetch, { Response } from 'node-fetch'
import { ROOT_URL } from './utils';

function executeCode(code: string, language: string): Promise<Response> {
  return fetch(`${ROOT_URL}/service/control/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code,
      language
    })
  })
}

describe("JavaScript", () => {
  it("can execute basic code", async () => {
    const code = `console.log(1 + 1)`
    const resp = await executeCode(code, "javascript")
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expect(body).toHaveProperty('version', '') // TODO: add version
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})

describe("Python", () => {
  it("can execute basic code", async () => {
    const resp = await executeCode("print(1+1)", "python")
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expect(body).toHaveProperty('version', '') // TODO: add version
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})

describe("Java", () => {
  it("can execute basic code", async () => {
    const code = `
package org.example;

public class Example {
  public static void main(String[] args) {
    System.out.println(1 + 1);
  }
}
    `
    const resp = await executeCode(code, "java")
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expect(body).toHaveProperty('version', '') // TODO: add version
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})

describe("C#", () => {
  it("can execute basic code", async () => {
    const code = `
using System;

namespace e2e
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine(1 + 1);
        }
    }
}`
    const resp = await executeCode(code, "csharp")
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expect(body).toHaveProperty('version', '') // TODO: add version
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})