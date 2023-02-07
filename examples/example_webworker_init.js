importScripts('lg2.js');

let git_libgit2_init = Module._git_libgit2_init;

// int git_repository_init(git_repository **out, const char *path, unsigned int is_bare);
let git_repository_init = Module.cwrap('git_repository_init', 'number', ['number','string','number'])

let git_index_add_bypath = Module.cwrap('git_index_add_bypath', 'number', ['number','string']);

let git_status_t = {
	GIT_STATUS_CURRENT: 0,
	GIT_STATUS_INDEX_NEW       : (1 << 0),
	GIT_STATUS_INDEX_MODIFIED  : (1 << 1),
	GIT_STATUS_INDEX_DELETED   : (1 << 2),
	GIT_STATUS_INDEX_RENAMED   : (1 << 3),
	GIT_STATUS_INDEX_TYPECHANGE: (1 << 4),

	GIT_STATUS_WT_NEW          : (1 << 7),
	GIT_STATUS_WT_MODIFIED     : (1 << 8),
	GIT_STATUS_WT_DELETED      : (1 << 9),
	GIT_STATUS_WT_TYPECHANGE   : (1 << 10),
	GIT_STATUS_WT_RENAMED      : (1 << 11),
	GIT_STATUS_WT_UNREADABLE   : (1 << 12),

	GIT_STATUS_IGNORED         : (1 << 14),
	GIT_STATUS_CONFLICTED      : (1 << 15)
};

Module.onRuntimeInitialized = () => {

    FS.mkdir('/project');
    FS.mount(MEMFS, { }, '/project');
    FS.chdir('/project');

    FS.writeFile('/home/web_user/.gitconfig', '[user]\n' +
                'name = Test User\n' +
                'email = test@example.com');

    // By default, wasm uses 4 bytes for pointer, unless it's wasm64
    let p$repo = Module._malloc(4);

    console.log(git_libgit2_init());

    checked(git_repository_init, p$repo, "/project", 0, "Couldn't init repo")

    FS.writeFile('index.html', 'Hello');
    FS.writeFile('1.js', 'alert(1)');
    FS.writeFile('2.js', 'alert(2)');

    let repo = Module.getValue(p$repo, '*');

    add(repo);

    Module.callMain(['status']);


};

function checked(f, ...args) {
    let error = args.pop();
    let result = f(...args);
    if (result) {
        throw new Error(error + ", code " + result);
    }
}

function test() {
    /*
    typedef struct git_strarray {
        char **strings;
        size_t count;
    } git_strarray;
    */

    let pathspec = Module._malloc(8);

    let p$strings = Module._malloc(4 * 2);

    let paths = ['1.js', '2.js'];

    for(let i = 0; i < paths.length; i++) {
        let path = paths[i];
        let lengthBytes = Module.lengthBytesUTF8(path) + 1;
        let p$ = Module._malloc(lengthBytes);
        Module.stringToUTF8(path, p$, lengthBytes);
        Module.setValue(p$strings + i * 4, p$, "*");
    }

    Module.setValue(pathspec, p$strings, "i32");
    Module.setValue(pathspec+4, 2, "i32");


    // int git_index_add_all(
    //    git_index *index,
    //    const git_strarray *pathspec,
    //    unsigned int flags,
    //    git_index_matched_path_cb callback,
    //    void *payload
    // );
    Module._git_strarray_print(pathspec);

}

function add(repo, files) {

    let p$index = Module._malloc(4);

    // int git_repository_index(git_index **out, git_repository *repo);
    checked(Module._git_repository_index, p$index, repo, "Could not open repository index");

    let index = Module.getValue(p$index, "i32");
    /*
    typedef struct git_strarray {
        char **strings;
        size_t count;
    } git_strarray;
    */

    let paths = ['1.js', '2.js'];

    // git_strarray = pointer + 4-byte int = 8 bytes
    let pathspec = Module._malloc(8);

    // struct for strings
    let p$strings = Module._malloc(4 * paths.length);

    for(let i = 0; i < paths.length; i++) {
        let path = paths[i];
        let lengthBytes = Module.lengthBytesUTF8(path) + 1;
        let p$string = Module._malloc(lengthBytes);
        Module.stringToUTF8(path, p$string, lengthBytes);
        // write pointer to each string into p$strings
        Module.setValue(p$strings + i * 4, p$string, "*");
    }

    Module.setValue(pathspec, p$strings, "*");
    Module.setValue(pathspec + 4, paths.length, "*");

    // int git_index_add_all(
    //    git_index *index,
    //    const git_strarray *pathspec,
    //    unsigned int flags,
    //    git_index_matched_path_cb callback,
    //    void *payload
    // );
    // Module._git_strarray_print(pathspec);


    // let res = git_index_add_bypath(Module.getValue(p$index, "i32"), "1.js");
    // console.log("res", res)

    let r = Module._git_index_add_all(index, pathspec, 0, null, null);
    console.log("result", r );

    /*
    git_status_list_new(
        git_status_list **out,
        git_repository *repo,
        const git_status_options *opts)
    */

    /*
    struct git_status_list {
        git_status_options opts;

        git_diff *head2idx;
        git_diff *idx2wd;

        git_vector paired;
    };
    */

    let p$status = Module._malloc(4);
    let rs = Module._git_status_list_new(p$status, repo, 0, null, null);
    console.log("result status", rs);

    let status = Module.getValue(p$status, '*');

    let entryCount = Module._git_status_list_entrycount(status);

    for (let i = 0; i < entryCount; i++) {
        let statusEntry = Module._git_status_byindex(status, i);
        /* const git_status_entry * git_status_byindex(git_status_list *statuslist, size_t idx); */

        /*
        typedef struct {
            git_status_t status;
            git_diff_delta *head_to_index;
            git_diff_delta *index_to_workdir;
        } git_status_entry;
        */

        let statusCode = Module.getValue(statusEntry, 'i32');
        console.log("statusCode", statusCode);
        for(let k in git_status_t) {
            if (git_status_t[k] == statusCode) {
                console.log(k);
            }
        }

    }

    // Write in-memory index changes to disk
	Module._git_index_write(index);

	Module._git_index_free(index);

    console.log(entryCount);
}


/*
int lg2_add(git_repository *repo, int argc, char **argv)
{
	git_index_matched_path_cb matched_cb = NULL;
	git_index *index;
	git_strarray array = {0};
	struct index_options options = {0};
	struct args_info args = ARGS_INFO_INIT;

	options.mode = INDEX_ADD;

	check_lg2(git_repository_index(&index, repo), "Could not open repository index", NULL);

	options.repo = repo;

	if (options.add_update) {
		git_index_update_all(index, &array, matched_cb, &options);
	} else {
		git_index_add_all(index, &array, 0, matched_cb, &options);
	}

	git_index_write(index);
	git_index_free(index);

	return 0;
}*/