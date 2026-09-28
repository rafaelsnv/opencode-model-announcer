/**
 * opencode-model-announcer V2 - Ported from V1
 *
 * Automatically announces the current model in the chat context.
 * V2 Port: Converted from V1 Plugin API to V2 Plugin.define() pattern
 */

import { Plugin } from "@opencode/plugin"
import type { Message, Part } from "@opencode/sdk"

export default Plugin.define({
  id: "opencode-model-announcer",
  async setup(ctx) {
    // V2: Use ctx.session.hook("context", ...) for chat.messages.transform equivalent
    // The "context" hook runs immediately before an agent model request

    await ctx.session.hook("context", async (event) => {
      const messages = event.messages
      if (!messages || messages.length === 0) return

      // Find the last user message to inject the announcement
      const lastUser = messages.findLast((m) => m.info.role === "user")
      if (!lastUser) return

      // Get model info from message
      const modelInfo = lastUser.info.model
      if (!modelInfo) return

      const { providerID, modelID } = modelInfo

      // Check if already announced
      const alreadyAnnounced = lastUser.parts.some(
        (p: any) =>
          p.type === "text" &&
          p.synthetic &&
          p.text?.includes("CURRENT_MODEL_ANNOUNCEMENT"),
      )
      if (alreadyAnnounced) return

      // Get model name from provider
      const name = await getModelName(ctx, providerID, modelID)
      const displayName = name
        ? `${name} (${providerID}/${modelID})`
        : `${providerID}/${modelID}`

      const announcement = `[SYSTEM: CURRENT_MODEL_ANNOUNCEMENT - You are ${displayName}. This message is SYNTHETIC and invisible to the user. Do not announce your identity unless explicitly asked.]`

      const part: Part = {
        type: "text",
        id: `synthetic-part-${Date.now()}`,
        sessionID: lastUser.info.sessionID,
        messageID: lastUser.info.id,
        text: announcement,
        synthetic: true,
      }

      // Add synthetic part to message
      if (!lastUser.parts) {
        lastUser.parts = []
      }
      lastUser.parts.unshift(part)
    })
  },
})

/**
 * Get model name from provider (V2 adaptation)
 */
async function getModelName(
  ctx: any,
  providerID: string,
  modelID: string,
): Promise<string | undefined> {
  try {
    // V2: Use ctx.provider to list providers
    // The API may differ in V2
    const response = await ctx.provider.list?.()
    if (!response) return undefined

    const data = response.data || response
    if (!data || !Array.isArray(data.all)) return undefined

    const provider = data.all.find((p: any) => p.id === providerID)
    if (!provider || !provider.models) return undefined

    const model = provider.models[modelID]
    return model?.name
  } catch {
    return undefined
  }
}
