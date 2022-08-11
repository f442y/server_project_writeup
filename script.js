// ************************ Initialize static variables and objects ***********

// (State)
// Page contents object
const sections = [
    ["intro_page", "Intro"],
    ["setting_up_server_nodes", "Setting Up Server Nodes"],
    ["setting_up_system_architecture", "Setting Up System Architecture"],
]

// Initialize a new DOMParser to parse a string of HTML into a HTML document object
const parser = new DOMParser();

// Initialize a Showdown converter to convert markdown to HTML
const converter = new showdown.Converter();

// ************************ Initialize a page state object ********************

// This Map() will hold the parsed and processed HTML objects for each section
const sections_map = new Map();

// Map each section from sections object into new Map()
// Add null entry (html_element) to hold HTML document object for section
sections.forEach(section => {
    sections_map.set(section[0], {
        id: section[0],
        title: section[1],
        html_element: null
    });
})

// Initialize page structure
// This object holds the page 'state'
// Add dynamically changing objects and variables
const structure = {
    sections_map: sections_map,
    active_section: "intro_page",
    theme_mode: "dark-mode",
    fixed_paths: {
        image_files: "/server_project_md/",
        markdown_files: "/server_project_md/",
    },
}

// ****************************************************************************

// This is the root function of the script.
// All other script functions are called by this function
// This is the only function directly called by this script (called at end)
main = async () => {
    // Before loading the page, the github pages check is run.
    await githubPagesCheck();

    // The sidebar structure is initialized to allow loading of individual sections when requested.
    await initSidebar();
    
    // Initialize page to default active section in structure.
    await updatePage();
}

/**
 * To load files on github pages, the server requires the absolute path of the resource,
 * therefore, when the URL is one of "github.io", the fixed path to download the
 * markdown files uses an absolute path which includes the repository name.
 * When using a http server, the fixed path only needs to be relative.
 */
githubPagesCheck = () => {
    const hostname = window.location.hostname.split(".").slice(-2).join(".");
    if (hostname == "github.io") {
        structure.fixed_paths.markdown_files = `/${window.location.pathname.split("/")[1]}/server_project_md/`;
    }
}

// ************************ Sidebar *******************************************

// Trigger initialization of each section in sidebar.
initSidebar = () => {
    structure.sections_map.forEach(section => {
        initSidebarSection(section.id, section.title);
    })
}

// Create and append HTML elements for a sidebar section, with click listener.
initSidebarSection = (section_id, section_title) => {
    let details_element = document.createElement("details");
    details_element.id = `${section_id}_sidebar`;
    details_element.classList.add("collapse-panel");

    let summary_element = document.createElement("summary");
    summary_element.classList.add("collapse-header", "sidebar-link", "sidebar-link-with-icon", "without-arrow");

    let summary_element_icon = document.createElement("span");
    summary_element_icon.classList.add("sidebar-icon");
    let summary_element_icon_img = document.createElement("img");
    summary_element_icon_img.id = `${section_id}_sidebar_download_icon`;
    summary_element_icon_img.src = `./web_assets/download-icon.png`;
    summary_element_icon_img.classList.add("img-fluid", "w-three-quarter");
    summary_element_icon.append(summary_element_icon_img);
    summary_element.append(summary_element_icon);

    summary_element.append(section_title);

    var content_element = document.createElement("div");
    content_element.id = `${section_id}_sidebar_content`;
    content_element.classList.add("collapse-content");
    content_element.innerHTML = "Generating Contents..."

    details_element.append(summary_element);
    details_element.append(content_element);

    details_element.addEventListener(
        "click",
        () => {
            structure.active_section = section_id;
            updatePage();
        },
    )

    document.getElementById("sidebar-sections").appendChild(details_element);
}


updateSidebarContents = () => {
    const contents = document.createElement("div");
    contents.id = "toc";

    const active_section_id = structure.active_section;
    const element = structure.sections_map.get(active_section_id).html_element.cloneNode(true);
    const headers_in_body_list = element.body.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headers_in_body_list.forEach(header => {
        const div = document.createElement("div");
        div.classList.add("container");
        const a = document.createElement("a");
        a.innerHTML = header.innerHTML;
        a.href = `#${header.id}`;
        a.classList.add(`ml-${(header.tagName.charAt(1) * 5) - 10}`)
        div.append(a);
        if (header.tagName.charAt(1) < 4) {
            div.classList.add("pt-20", "font-weight-semi-bold");
            contents.append(div);
            const divider = document.createElement("div")
            divider.classList.add("sidebar-divider");
            contents.append(divider);
        } else {
            contents.append(div);
        }

    })
    sidebar_content_element = document.getElementById(`${active_section_id}_sidebar_content`);
    sidebar_content_element.innerHTML = "";
    sidebar_content_element.append(contents);
}

updateSidebarAccordion = () => {
    structure.sections_map.forEach(section => {
        if (structure.active_section == section.id) {
            document.getElementById(`${section.id}_sidebar`).open = true;
        } else {
            document.getElementById(`${section.id}_sidebar`).open = false;
        }
    })
}

// ************************ Page **********************************************

updatePage = async () => {
    await fetchMD_ProcessAndAppendToStructure();
    updateSidebarAccordion();
    updateContent();
    addClassesToTags();
    updateSidebarContents();
}

// ************************ Content *******************************************

// Fetch and process markdown to HTML element and save to structure
fetchMD_ProcessAndAppendToStructure = async () => {
    const active_section_id = structure.active_section;
    // Fetch the Markdown file in text format
    md_text = await fetchMDfile(structure.fixed_paths.markdown_files, active_section_id);

    // While the file is in text format, remove the table of contents (TOC) for the file
    md_text_no_TOC = await removeTOC(md_text);

    // Convert the Markdown text into HTML text
    html_text = await converter.makeHtml(md_text_no_TOC);

    // Convert the HTML text into a HTML document (documentElement)
    html_element = await convertTextToHtmlDocument(html_text);

    // Edit src of img tags in HTML document
    html_element = editImgSrc(html_element, structure.fixed_paths.image_files, active_section_id);

    // Save HTML document element to sections Map().
    structure.sections_map.get(active_section_id).html_element = html_element;

    // Update image in sidebar signify section has been downloaded and persisted.
    document.getElementById(`${active_section_id}_sidebar_download_icon`).src = `./web_assets/download-icon-green.png`
}

// Fetch markdown MD file and return filed contents as text.
fetchMDfile = async (fixed_path_md, section_name) => {
    return await fetch(`${fixed_path_md}${section_name}/${section_name}.md`)
        .then(r => r.text())
        .then(t => {
            return t;
        });
}

/**
 * The markdown files contain an automatically generated table of contents (TOC).
 * To prevent the table from being processed into HTML, it is removed.
 * The markdown file contains a comment to mark the beginning and end of the table.
 * <!-- TOC:start --> and <!-- TOC:end -->
 * All text between these two comments is removed.
 */
removeTOC = async (md_text) => {
    const nregex = new RegExp("<!-- TOC:start -->[\\d\\D]*?\<!-- TOC:end -->", "g");
    return md_text.replace(nregex, "");
}

// Parse markdown text to HTML document object. 
convertTextToHtmlDocument = (html_text) => {
    return parser.parseFromString(html_text, 'text/html');
}

/**
 * As the src tags of all images in the markdown files are defined relatively, the src 
 * tags need to be redefined to the full path relative to the index.html file.
 */
editImgSrc = (html_element, fixed_path_images, section_name) => {
    html_element.querySelectorAll("img").forEach(img => {
        img.src = img.src.replace("/resources", `${fixed_path_images}${section_name}/resources`);
    })
    return html_element;
}


// Update contents to current active section
updateContent = async () => {
    let content = document.getElementById("content");
    content.innerHTML = "";
    const element = structure.sections_map.get(structure.active_section).html_element.cloneNode(true);
    const elements_in_body_list = Array.prototype.slice.call(element.body.querySelectorAll('body > *'));
    elements_in_body_list.forEach(element => {
        const a = element.querySelectorAll("a");
        if (a.length > 0) {
            editContentLinkTags(a);
        };
        document.getElementById("content").appendChild(element);
    })
}

// ************************ Process generated HTML ****************************

editContentLinkTags = async (anchorElement) => {
    anchorElement.forEach(a => {
        const href = a.getAttribute("href");
        if (href.charAt(0) == "#") {
            a.setAttribute("href", href.replaceAll("-", ""));
        } else {
            a.setAttribute("target", "_blank")
        };

    });
}


/**
 * To correctly format the HTML, classes can be added to the HTML tags, this allows 
 * the correct CSS formatting of the HTML elements.
 */
addClassesToTags = () => {
    // Root div of section
    html_element = document.getElementById("content")

    // Individual tags of section
    html_element.querySelectorAll("p").forEach(tag => {
        tag.classList.add();
    });
    html_element.querySelectorAll("h2").forEach(tag => {
        tag.classList.add();
    });
    html_element.querySelectorAll("img").forEach(tag => {
        tag.classList.add("img-fluid", "rounded");
    });
    html_element.querySelectorAll("code").forEach(tag => {
        tag.classList.add("hljs");
    });
    html_element.querySelectorAll("pre").forEach(tag => {
        tag.classList.add("scroll", "hljs");
    });
    html_element.querySelectorAll("blockquote").forEach(tag => {
        tag.classList.add("text-muted");
    });

}

// ************************ Page Toggles **************************************

// Function to change theme on all code snippets (HLJS).
switchHLJSTheme = () => {
    const hljsDarkStyle = document.getElementById("hljs-dark-style");
    const hljsLightStyle = document.getElementById("hljs-light-style");

    if (structure.theme_mode == "light-mode") {
        hljsDarkStyle.disabled = true
        hljsLightStyle.disabled = false
    } else {
        hljsDarkStyle.disabled = false
        hljsLightStyle.disabled = true
    }
}

// Function to change image in theme mode button.
switchThemeToggleImage = () => {
    const theme_image_element = document.getElementById("theme_img");
    if (structure.theme_mode == "light-mode") {
        theme_image_element.src = "./web_assets/moon.png";
    } else {
        theme_image_element.src = "./web_assets/sun.png";
    }
}

// Toggle to switch theme on page, calls all other theme change functions
themeChangeToggle = () => {
    halfmoon.toggleDarkMode();
    structure.theme_mode = halfmoon.getPreferredMode();
    switchThemeToggleImage();
    switchHLJSTheme();
}

// Set theme of page on page load (auto runs on page load)
window.onload = () => {
    structure.theme_mode = halfmoon.getPreferredMode();
    switchThemeToggleImage();
    switchHLJSTheme();
}

main();