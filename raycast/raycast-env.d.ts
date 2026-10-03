/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `send` command */
  export type Send = ExtensionPreferences & {}
  /** Preferences accessible in the `receive` command */
  export type Receive = ExtensionPreferences & {}
  /** Preferences accessible in the `copy-web-link` command */
  export type CopyWebLink = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `send` command */
  export type Send = {}
  /** Arguments passed to the `receive` command */
  export type Receive = {}
  /** Arguments passed to the `copy-web-link` command */
  export type CopyWebLink = {}
}

