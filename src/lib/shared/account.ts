// Account deletion (#40).

/**
 * How long nightly backups keep deleted data before they rotate out. The VPS backup
 * job (#7) must keep no more than this, since the deletion page promises it.
 */
export const BACKUP_RETENTION_DAYS = 30;

/** The typed confirmation must match the account's email, ignoring case and spaces. */
export const confirmsEmail = (typed: string, email: string) =>
	typed.trim().toLowerCase() === email.trim().toLowerCase();
