import { Positions } from "@Constants"
import { Collection, GuildMember, Role, User } from "discord.js"
import { PositionRole, UserProfile, UserRejoinRoles } from "../db"
import type { ScrimsBot } from "./ScrimsBot"

export class PermissionsManager {
    constructor(protected readonly bot: ScrimsBot) {}

    get host() {
        return this.bot.host
    }

    protected getHostMember(userId: string) {
        return this.host?.members.cache.get(userId)
    }

    protected getGuild(guildId: string) {
        return this.bot.guilds.cache.get(guildId)
    }

    getUsersPositions(user: UserResolvable) {
        return new Set(
            PositionRole.cache.filter((v) => this.hasPosition(user, v.position)).map((v) => v.position),
        )
    }

    getUsersForbiddenPositions(user: UserResolvable) {
        return new Set(
            PositionRole.cache
                .filter((v) => this.hasPosition(user, v.position) === false)
                .map((v) => v.position),
        )
    }

    getUsersWithPosition(position: string, guildId = this.bot.hostGuildId): Collection<string, GuildMember> {
        const roles = PositionRole.getPositionRoles(position, guildId).map((v) => v.roleId)
        return (
            this.getGuild(guildId)?.members.cache.filter((m) =>
                this._hasPosition(m, position, roles, guildId),
            ) ?? new Collection()
        )
    }

    hasPosition(user: UserResolvable, position: string, guildId = this.bot.hostGuildId): PositionResult {
        const roles = PositionRole.getPositionRoles(position, guildId).map((v) => v.roleId)
        return this._hasPosition(user, position, roles, guildId)
    }

    private _hasPosition(
        user: UserResolvable,
        position: string,
        roles: string[],
        guildId: string,
    ): PositionResult {
        const expiration = async () => undefined

        if (position === Positions.Banned)
            return this.getGuild(guildId)?.bans.cache.get(user.id) && { expiration }

        if (this.hasPosition(user, Positions.Banned, guildId)) return false
        return this.hasRoles(user, guildId, roles) && { expiration }
    }

    hasPositionLevel(user: UserResolvable, positionLevel: string, guildId = this.bot.hostGuildId) {
        const positionRoles = PositionRole.getRoles(positionLevel, guildId)
        const positionRoleIds = positionRoles.map((r) => r.id)
        const highest = positionRoles.sort((a, b) => b.comparePositionTo(a))[0]
        if (highest)
            PositionRole.cache
                .filter((v) => v.guildId === highest.guild.id)
                .map((v) => v.role())
                .filter((r): r is Role => !!r && r.comparePositionTo(highest) > 0)
                .forEach((r) => positionRoleIds.push(r.id))

        return this.hasRoles(user, guildId, positionRoleIds)
    }

    protected hasRoles(user: UserResolvable, guildId: string, roles: string[]) {
        if (!roles.length) return undefined

        const member = this.getGuild(guildId)?.members.resolve(user.id)
        if (!member) return undefined

        // @ts-expect-error the getter on member.roles.cache is very inefficient
        return roles.some((v) => member._roles.includes(v))
    }

    hasPermissions(user: UserResolvable, permissions: Permissions) {
        const member = this.getHostMember(user.id)
        const hasPositions = permissions.positions?.some((p) => this.hasPosition(user, p))
        const hasPositionLevel = permissions.positionLevel
            ? !!this.hasPositionLevel(user, permissions.positionLevel)
            : undefined

        const required = [hasPositions, hasPositionLevel]
        return (
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            member?.permissions.has("Administrator") || required.some((v) => v === true)
        )
    }

    async addPosition(user: UserResolvable, position: string, reason: string) {
        return this.updatePositions(user, position, reason, false)
    }

    async removePosition(user: UserResolvable, position: string, reason: string) {
        return this.updatePositions(user, position, reason, true)
    }

    protected async updatePositions(user: UserResolvable, position: string, reason: string, remove: boolean) {
        const roles = PositionRole.getPermittedRoles(position, this.bot.hostGuildId)
        const member = this.host?.members.resolve(user.id)
        if (member) {
            await Promise.all(
                roles.map((v) => (remove ? member.roles.remove(v, reason) : member.roles.add(v, reason))),
            )
        } else {
            const cmd = remove ? "$pull" : "$push"
            await UserRejoinRoles.updateOne(
                { _id: user.id },
                { [cmd]: { roles: { $in: roles.map((v) => v.id) } } },
            )
        }
    }
}

export interface Permissions {
    positions?: string[]
    positionLevel?: string
}

export type PositionResult = false | undefined | { expiration: () => Promise<Date | undefined> }
type UserResolvable = User | GuildMember | UserProfile
