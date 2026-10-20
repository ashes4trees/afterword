import { crc32, deflateRawSync } from 'node:zlib';

// A minimal zip writer for the data export (#17): deflated files, no folders or
// encryption, which every unzip tool and spreadsheet program reads.

export function zipFiles(
	files: { name: string; data: string }[],
	date = new Date()
): Uint8Array<ArrayBuffer> {
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
	const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
	const locals: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;

	for (const file of files) {
		const name = Buffer.from(file.name, 'utf8');
		const raw = Buffer.from(file.data, 'utf8');
		const packed = deflateRawSync(raw);
		const crc = crc32(raw);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4); // version needed
		local.writeUInt16LE(0x0800, 6); // UTF-8 names
		local.writeUInt16LE(8, 8); // deflate
		local.writeUInt16LE(time, 10);
		local.writeUInt16LE(day, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(packed.length, 18);
		local.writeUInt32LE(raw.length, 22);
		local.writeUInt16LE(name.length, 26);
		locals.push(local, name, packed);

		const entry = Buffer.alloc(46);
		entry.writeUInt32LE(0x02014b50, 0);
		entry.writeUInt16LE(20, 4); // version made by
		entry.writeUInt16LE(20, 6);
		entry.writeUInt16LE(0x0800, 8);
		entry.writeUInt16LE(8, 10);
		entry.writeUInt16LE(time, 12);
		entry.writeUInt16LE(day, 14);
		entry.writeUInt32LE(crc, 16);
		entry.writeUInt32LE(packed.length, 20);
		entry.writeUInt32LE(raw.length, 24);
		entry.writeUInt16LE(name.length, 28);
		entry.writeUInt32LE(offset, 42);
		central.push(entry, name);

		offset += local.length + name.length + packed.length;
	}

	const directory = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(directory.length, 12);
	end.writeUInt32LE(offset, 16);
	const out = Buffer.concat([...locals, directory, end]);
	return new Uint8Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.length));
}
